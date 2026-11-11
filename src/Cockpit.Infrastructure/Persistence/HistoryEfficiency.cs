using System.Globalization;
using System.Runtime.CompilerServices;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cockpit.Infrastructure.Persistence;

public sealed partial class SqliteHistoryStore
{
    private static readonly string[] EnergyKeys = ["heatPowerConsumption", "coolPowerConsumption", "dhwPowerConsumption"];
    private static readonly string[] CopKeys = [.. EnergyKeys, "heatPowerProduction", "dhwPowerProduction",
        "heatpumpState", "compressorFrequency", "defrostState", "internalHeaterState", "operatingMode", "threeWayValveState", "alternativeHeatpumpPower", "alternativeHeaterPower", "alternativePowerEnabled", "alternativePowerGeneration"];
    private sealed record PowerFrame(long Time, double?[] Values, long?[] Received)
    {
        public bool Compatible(IEnumerable<int> indices, int skew)
        {
            var selected = indices.ToArray();
            return selected.All(i => Values[i] is { } v && double.IsFinite(v) && v >= 0 && Received[i].HasValue)
                && selected.Max(i => Received[i]!.Value) - selected.Min(i => Received[i]!.Value) <= skew * 1000L;
        }
        public int EnergyMode(int skew) => !Compatible([0, 1, 2], skew) || Values.Take(3).Count(v => v > 0) > 1
            ? -1 : Values[0] > 0 ? 0 : Values[1] > 0 ? 1 : Values[2] > 0 ? 2 : 3;
        public bool Alternative => Values[13] == 1;
        public string Generation => (Alternative ? "alternative:" : "extra:") + (Values[14] ?? 0).ToString(CultureInfo.InvariantCulture);
        public int[] RequiredIndices(string mode) => Alternative
            ? [mode == "heat" ? 3 : 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
            : [0, 1, 2, mode == "heat" ? 3 : 4, 5, 6, 7, 8, 9, 10];
        public (string Mode, double Electric, double Thermal, double State)? Cop(CopPolicy policy, int sampleSeconds)
        {
            var mode = Alternative ? Values[10] == 0 ? 0 : Values[10] == 1 ? 2 : -1 : EnergyMode(CopPolicy.MaxAgeSeconds);
            if (mode is not (0 or 2)) return null;
            var thermal = mode == 0 ? 3 : 4;
            var required = RequiredIndices(mode == 0 ? "heat" : "dhw");
            var electric = Alternative ? Values[11] + Values[12] : Values[mode];
            if (!Compatible(required, CopPolicy.MaxAgeSeconds)
                || !Compatible(Alternative ? [11, 12, thermal] : [mode, thermal], policy.MaxPairSeconds)
                || required.Any(i => Received[i] >= (Time + sampleSeconds) * 1000
                    || Time * 1000 - Received[i] > CopPolicy.MaxAgeSeconds * 1000L)
                || Values[5] != 1 || Values[6] <= 0 || Values[7] != 0 || Values[8] != 0
                || electric is null || !double.IsFinite(electric.Value) || electric < policy.MinimumElectricalWatts) return null;
            var state = Values[9]!.Value;
            if (mode == 0 && (Values[10] != 0 || state is not (0 or 2 or 4 or 6))) return null;
            if (mode == 2 && (Values[10] != 1 || state is not (3 or 4 or 5 or 6 or 8))) return null;
            return (mode == 0 ? "heat" : "dhw", electric.Value, Values[thermal]!.Value, state);
        }
    }

    // A bounded-output stream avoids retaining a year of raw power samples in memory.
    private async IAsyncEnumerable<PowerFrame> PowerFrames(string[] keys, long from, long to,
        [EnumeratorCancellation] CancellationToken token)
    {
        await using var db = new HistoryDb(options);
        await db.Database.OpenConnectionAsync(token);
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandTimeout = 15;
        var columns = keys.SelectMany((_, i) => new[] {
            $"MAX(CASE WHEN Key=$k{i} AND Quality=1 AND Retained=0 THEN Value END)",
            $"MAX(CASE WHEN Key=$k{i} AND Quality=1 AND Retained=0 THEN Received END)" });
        command.CommandText = $"SELECT Time,{string.Join(',', columns)} FROM Samples WHERE Time >= $from AND Time <= $to AND Key IN ({string.Join(',', keys.Select((_, i) => "$k" + i))}) GROUP BY Time ORDER BY Time";
        void Parameter(string name, object value) { var p = command.CreateParameter(); p.ParameterName = name; p.Value = value; command.Parameters.Add(p); }
        Parameter("$from", from); Parameter("$to", to);
        for (var i = 0; i < keys.Length; i++) Parameter("$k" + i, keys[i]);
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token))
        {
            var values = new double?[keys.Length]; var received = new long?[keys.Length];
            for (var i = 0; i < keys.Length; i++)
            { values[i] = reader.IsDBNull(i * 2 + 1) ? null : reader.GetDouble(i * 2 + 1); received[i] = reader.IsDBNull(i * 2 + 2) ? null : reader.GetInt64(i * 2 + 2); }
            yield return new(reader.GetInt64(0), values, received);
        }
    }
    private sealed record CopFrame(double Time, string Generation, string? Mode, double Electric, double Thermal, int? State, double ValidUntil = double.MaxValue);
    private async IAsyncEnumerable<CopFrame> CopFrames(HistoryQuery query, int minutes, CopPolicy policy, [EnumeratorCancellation] CancellationToken token)
    {
        await foreach (var s in PowerFrames(CopKeys, Math.Max(0, query.From.ToUnixTimeSeconds() - minutes * 60 - Policy.SampleSeconds), CeilingSeconds(query.To) + Policy.SampleSeconds, token))
        {
            var c = s.Cop(policy, Policy.SampleSeconds);
            var oldest = c.HasValue ? s.RequiredIndices(c.Value.Mode).Select(i => s.Received[i]).Min() : null;
            yield return new(s.Time, s.Generation, c?.Mode, c?.Electric ?? 0, c?.Thermal ?? 0, c.HasValue ? (int)c.Value.State : null,
                oldest.HasValue ? oldest.Value / 1000d + CopPolicy.MaxAgeSeconds : 0);
        }
    }
    private sealed class CopBucket
    {
        public double Seconds, Sum, AverageSeconds, AverageSum;
        public string? Mode;
        public string? Generation;
        public bool Mixed;
    }
    public async Task<CopResult> CopAsync(HistoryQuery query, int windowMinutes, CopPolicy policy, CancellationToken token)
    {
        query.Validate(Policy); policy.Validate();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30)); token = deadline.Token;
        if (query.Keys.Length != 1 || query.Keys[0] != EnergyKeys[0] || query.To - query.From > TimeSpan.FromDays(31)
            || windowMinutes is not (5 or 15 or 30))
            throw new HistoryRequestException("invalid_cop_query", "COP: maximal 31 Tage, Fenster 5/15/30 Minuten, Schlüssel heatPowerConsumption.");
        var from = query.From.ToUnixTimeMilliseconds() / 1000d;
        var to = query.To.ToUnixTimeMilliseconds() / 1000d;
        var width = query.BucketSeconds;
        var buckets = new Dictionary<(long Time, string Mode), CopBucket>();
        double validSeconds = 0, electricEnergy = 0, thermalEnergy = 0;
        var electricalSources = new HashSet<string>();
        await readers.WaitAsync(token);
        try
        {
            var window = new LinkedList<(double Value, double Seconds)>(); double sum = 0, windowSeconds = 0;
            CopFrame? previous = null;
            await foreach (var frame in CopFrames(query, windowMinutes, policy, token))
            {
                if (frame.Time >= from && frame.Time < to) electricalSources.Add(frame.Generation.StartsWith("alternative:", StringComparison.Ordinal) ? "alternative-mqtt" : "heishamon-extra");
                var a = previous; var b = frame;
                if (a is null || a.Mode is null || b.Mode is null || b.Time <= a.Time || a.Generation != b.Generation
                    || b.Time - a.Time != Policy.SampleSeconds
                    || b.Time > a.ValidUntil || a.Mode != b.Mode || a.State != b.State)
                { window.Clear(); sum = 0; windowSeconds = 0; previous = frame; continue; }
                var value = a.Thermal / a.Electric;
                if (!double.IsFinite(value)) { window.Clear(); sum = 0; windowSeconds = 0; previous = frame; continue; }
                var intervalSeconds = frame.Time - a.Time;
                window.AddLast((value, intervalSeconds)); sum += value * intervalSeconds; windowSeconds += intervalSeconds;
                while (windowSeconds > windowMinutes * 60)
                {
                    var head = window.First!; var remove = Math.Min(head.Value.Seconds, windowSeconds - windowMinutes * 60);
                    sum -= head.Value.Value * remove; windowSeconds -= remove;
                    if (remove == head.Value.Seconds) window.RemoveFirst();
                    else head.Value = (head.Value.Value, head.Value.Seconds - remove);
                }
                double? average = Math.Abs(windowSeconds - windowMinutes * 60) < .000001 && double.IsFinite(sum) ? sum / windowSeconds : null;
                var start = Math.Max(from, a.Time); var end = Math.Min(to, frame.Time);
                if (end > start)
                {
                    validSeconds += end - start; electricEnergy += a.Electric * (end - start); thermalEnergy += a.Thermal * (end - start);
                    for (var t = start; t < end;)
                    {
                        var slot = (long)Math.Floor(t / width) * width;
                        var stop = Math.Min(end, slot + width); var seconds = stop - t;
                        var key = (slot, a.Mode);
                        if (!buckets.TryGetValue(key, out var bucket)) buckets[key] = bucket = new();
                        if (bucket.Mode is not null && (bucket.Mode != a.Mode || bucket.Generation != a.Generation)) bucket.Mixed = true;
                        bucket.Generation = a.Generation;
                        bucket.Mode = a.Mode; bucket.Seconds += seconds; bucket.Sum += value * seconds;
                        if (average.HasValue) { bucket.AverageSeconds += seconds; bucket.AverageSum += average.Value * seconds; }
                        t = stop;
                    }
                }
                previous = frame;
            }
        }
        finally { readers.Release(); }
        var points = new List<CopPoint>();
        var heating = new List<CopPoint>(); var hotWater = new List<CopPoint>();
        for (var t = (long)Math.Floor(from / width) * width; t < to; t += width)
        {
            var expected = Math.Min(to, t + width) - Math.Max(from, t);
            CopPoint Measured(string mode)
            {
                var b = buckets.GetValueOrDefault((t, mode));
                var valid = b is not null && b.Seconds > 0 && double.IsFinite(b.Sum);
                return new(DateTimeOffset.FromUnixTimeSeconds(t), valid ? mode : null,
                    valid ? b!.Sum / b.Seconds : null,
                    valid && !b!.Mixed && double.IsFinite(b.AverageSum) && Math.Abs(b.AverageSeconds - b.Seconds) < .001
                        ? b.AverageSum / b.AverageSeconds : null, b?.Seconds ?? 0, expected);
            }
            var heat = Measured("heat"); var dhw = Measured("dhw");
            heating.Add(heat); hotWater.Add(dhw);
            // Keep the existing single-mode rows for older clients. Mixed blocks
            // have two independent mode-series points, never a blended COP.
            points.Add(heat.Cop.HasValue && dhw.Cop.HasValue
                ? new(heat.Time, null, null, null, heat.ValidSeconds + dhw.ValidSeconds, expected)
                : heat.Cop.HasValue ? heat : dhw.Cop.HasValue ? dhw : new(heat.Time, null, null, null, 0, expected));
        }
        var ratio = electricEnergy > 0 ? thermalEnergy / electricEnergy : (double?)null;
        return new(query.From.ToUniversalTime(), query.To.ToUniversalTime(), width, windowMinutes, source,
            policy.MinimumElectricalWatts, policy.MaxPairSeconds, validSeconds, to - from,
            ratio.HasValue && double.IsFinite(ratio.Value) ? ratio : null, points)
        { ElectricalSource = electricalSources.Count > 1 ? "mixed" : electricalSources.SingleOrDefault() ?? "heishamon-extra",
            Series = [new("heat", heating), new("dhw", hotWater)] };
    }

    public async Task<EnergyResult> EnergyAsync(int year, int maxPairSeconds, DateTimeOffset now, CancellationToken token)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30)); token = deadline.Token;
        var result = await RecordedEnergyAsync(year, maxPairSeconds, now, token);
        var minima = new double?[result.Days.Count];
        var counts = new int[result.Days.Count];
        await readers.WaitAsync(token);
        try
        {
            var from = result.Days[0].From.ToUnixTimeSeconds();
            var to = Math.Min(result.Days[^1].To.ToUnixTimeSeconds(), now.ToUnixTimeSeconds());
            var day = 0;
            await foreach (var frame in PowerFrames(["outsideTemperature"], from, to, token))
            {
                while (day < result.Days.Count && frame.Time >= result.Days[day].To.ToUnixTimeSeconds()) day++;
                if (day == result.Days.Count) break;
                if (frame.Values[0] is not { } value || !double.IsFinite(value)) continue;
                minima[day] = minima[day] is { } min ? Math.Min(min, value) : value;
                counts[day]++;
            }
        }
        finally { readers.Release(); }
        return result with { Days = result.Days.Select((d, i) => d with {
            MinOutdoorTemperatureC = minima[i], OutdoorTemperatureSamples = counts[i]
        }).ToArray() };
    }

    private async Task<EnergyResult> ExtraEnergyAsync(int year, int maxPairSeconds, DateTimeOffset now, CancellationToken token)
    {
        if (year < 1971 || year > TimeZoneInfo.ConvertTime(now, EnergyCalendar.Berlin).Year || maxPairSeconds is < 0 or > 3600)
            throw new HistoryRequestException("invalid_year", "Bitte ein Jahr ab 1971 bis zum aktuellen Jahr wählen.");
        var first = new DateOnly(year, 1, 1); var count = DateTime.IsLeapYear(year) ? 366 : 365;
        var bounds = Enumerable.Range(0, count + 1).Select(i => EnergyCalendar.Midnight(first.AddDays(i))).ToArray();
        var energies = new double[count]; var durations = new double[count];
        await readers.WaitAsync(token);
        try
        {
            PowerFrame? previous = null; var day = 0;
            await foreach (var frame in PowerFrames(EnergyKeys, bounds[0].ToUnixTimeSeconds() - Policy.SampleSeconds,
                Math.Min(bounds[^1].ToUnixTimeSeconds(), now.ToUnixTimeSeconds()), token))
            {
                var mode = previous?.EnergyMode(maxPairSeconds) ?? -1;
                if (previous is not null && frame.Time - previous.Time == Policy.SampleSeconds && mode >= 0 && mode == frame.EnergyMode(maxPairSeconds))
                {
                    var start = Math.Max(previous.Time, bounds[0].ToUnixTimeSeconds());
                    var end = Math.Min(frame.Time, bounds[^1].ToUnixTimeSeconds());
                    var watts = previous.Values.Take(3).Sum(v => v!.Value);
                    while (start < end && day < count)
                    {
                        if (start >= bounds[day + 1].ToUnixTimeSeconds()) { day++; continue; }
                        var stop = Math.Min(end, bounds[day + 1].ToUnixTimeSeconds());
                        var energy = watts / 3600000 * (stop - start);
                        if (double.IsFinite(energy) && double.IsFinite(energies[day] + energy))
                        { energies[day] += energy; durations[day] += stop - start; }
                        start = stop;
                    }
                }
                previous = frame;
            }
        }
        finally { readers.Release(); }
        var days = Enumerable.Range(0, count).Select(i => {
            var expected = (bounds[i + 1] - bounds[i]).TotalSeconds;
            var status = bounds[i] > now ? "future" : bounds[i + 1] > now ? "current" : durations[i] == expected ? "complete" : durations[i] > 0 ? "partial" : "missing";
            return new EnergyDay(first.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), bounds[i], bounds[i + 1],
                durations[i] > 0 ? energies[i] : null, durations[i], expected, status);
        }).ToArray();
        return new(year, source, Catalog.KilowattHour, "Europe/Berlin", days);
    }
}
