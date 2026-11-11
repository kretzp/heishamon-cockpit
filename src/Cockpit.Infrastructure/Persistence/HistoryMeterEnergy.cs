using System.Globalization;
using System.Runtime.CompilerServices;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cockpit.Infrastructure.Persistence;

public sealed partial class SqliteHistoryStore
{
    private static readonly string[] MeterEnergyKeys = [.. EnergyKeys, "alternativeHeatpumpPower",
        "alternativeHeaterPower", "alternativePowerEnabled", "alternativePowerGeneration"];

    private async Task<EnergyResult> RecordedEnergyAsync(int year, int maxPairSeconds, DateTimeOffset now, CancellationToken token)
    {
        if (year < 1971 || year > TimeZoneInfo.ConvertTime(now, EnergyCalendar.Berlin).Year || maxPairSeconds is < 0 or > 3600)
            throw new HistoryRequestException("invalid_year", "Bitte ein Jahr ab 1971 bis zum aktuellen Jahr wählen.");
        var first = EnergyCalendar.Midnight(new DateOnly(year, 1, 1));
        var last = EnergyCalendar.Midnight(new DateOnly(year + 1, 1, 1));
        var sources = await MeterSourcesAsync(first, last, token);
        if (sources.LastRaw is null && (sources.FirstMarker is null || sources.FirstMarker >= last.ToUnixTimeSeconds()))
            return await ExtraEnergyAsync(year, maxPairSeconds, now, token);

        var calendar = new MeterEnergyCalendar(year, source, now);
        await readers.WaitAsync(token);
        try
        {
            if (sources.LastRaw.HasValue)
            {
                await RawMeterEnergyAsync(calendar, now, token);
                // The archive owns its whole historical period, including outages.
                // Converted 30-s rows must never be added on top of raw Shelly energy.
            }
            await SampleMeterEnergyAsync(calendar, maxPairSeconds, sources.LastRaw, sources.FirstMarker, now, token);
        }
        finally { readers.Release(); }
        return calendar.Result(Policy.SampleSeconds);
    }

    private async Task<(long? LastRaw, long? FirstMarker)> MeterSourcesAsync(DateTimeOffset first, DateTimeOffset last, CancellationToken token)
    {
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            await db.Database.OpenConnectionAsync(token);
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandTimeout = 15;
            command.CommandText = "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='ShellySamples')";
            long? lastRaw = null;
            if (Convert.ToInt64(await command.ExecuteScalarAsync(token), CultureInfo.InvariantCulture) == 1)
            {
                command.CommandText = "SELECT MAX(Time) FROM ShellySamples";
                var value = await command.ExecuteScalarAsync(token);
                if (value is not null and not DBNull) lastRaw = Convert.ToInt64(value, CultureInfo.InvariantCulture);
            }
            command.CommandText = "SELECT MIN(Time) FROM Samples WHERE Key='alternativePowerEnabled'";
            var marker = await command.ExecuteScalarAsync(token);
            return (lastRaw, marker is null or DBNull ? null : Convert.ToInt64(marker, CultureInfo.InvariantCulture));
        }
        finally { readers.Release(); }
    }

    private sealed record RawMeterFrame(long Time, string Generation, string Device,
        double? Heatpump, double? Heater, long? HeatpumpReceived, long? HeaterReceived)
    {
        public bool Fresh(double? watts, long? received) => watts.HasValue && double.IsFinite(watts.Value) && watts >= 0
            && received.HasValue && Time >= received && Time - received <= 20000;
        public bool Paired => Fresh(Heatpump, HeatpumpReceived) && Fresh(Heater, HeaterReceived)
            && Math.Abs(HeatpumpReceived!.Value - HeaterReceived!.Value) <= 10000;
    }

    private async IAsyncEnumerable<RawMeterFrame> RawMeterFrames(long from, long to, [EnumeratorCancellation] CancellationToken token)
    {
        await using var db = new HistoryDb(options);
        await db.Database.OpenConnectionAsync(token);
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandTimeout = 15;
        // Legacy physical columns: Heater=C=heatpump, Heatpump=A=heater.
        command.CommandText = """
            SELECT Time,Generation,DeviceId,Heater,Heatpump,HeaterReceived,HeatpumpReceived
            FROM ShellySamples WHERE Time >= $from AND Time <= $to ORDER BY Time,Id
            """;
        foreach (var (name, value) in new[] { ("$from", from), ("$to", to) })
        {
            var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.Value = value;
            command.Parameters.Add(parameter);
        }
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token))
            yield return new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetDouble(3), reader.IsDBNull(4) ? null : reader.GetDouble(4),
                reader.IsDBNull(5) ? null : reader.GetInt64(5), reader.IsDBNull(6) ? null : reader.GetInt64(6));
    }

    private async Task RawMeterEnergyAsync(MeterEnergyCalendar calendar, DateTimeOffset now, CancellationToken token)
    {
        RawMeterFrame? previous = null;
        await foreach (var current in RawMeterFrames(calendar.First - 20000, Math.Min(calendar.Last, now.ToUnixTimeMilliseconds()), token))
        {
            if (current.Time >= calendar.First && current.Time < calendar.Last) calendar.Sources.Add("shelly-ac");
            if (previous is { } p && current.Time > p.Time && current.Time - p.Time <= 20000
                && current.Generation == p.Generation && current.Device == p.Device)
            {
                var heatpump = p.Fresh(p.Heatpump, p.HeatpumpReceived) && current.Fresh(current.Heatpump, current.HeatpumpReceived)
                    && current.Time - p.HeatpumpReceived <= 20000;
                var heater = p.Fresh(p.Heater, p.HeaterReceived) && current.Fresh(current.Heater, current.HeaterReceived)
                    && current.Time - p.HeaterReceived <= 20000;
                calendar.Add(p.Time, current.Time, [p.Heatpump ?? 0, p.Heater ?? 0, (p.Heatpump ?? 0) + (p.Heater ?? 0)],
                    [heatpump, heater, heatpump && heater && p.Paired && current.Paired]);
            }
            previous = current;
        }
    }

    private async Task SampleMeterEnergyAsync(MeterEnergyCalendar calendar, int maxPairSeconds, long? lastRaw, long? firstMarker, DateTimeOffset now, CancellationToken token)
    {
        PowerFrame? previous = null;
        var from = Math.Max(calendar.First / 1000 - Policy.SampleSeconds, lastRaw.HasValue ? (lastRaw.Value + 999) / 1000 : 0);
        await foreach (var current in PowerFrames(MeterEnergyKeys, from, Math.Min(calendar.Last / 1000, now.ToUnixTimeSeconds()), token))
        {
            var p = previous; previous = current;
            if (p is null || current.Time - p.Time != Policy.SampleSeconds
                || p.Values[5] != current.Values[5] || p.Values[6] != current.Values[6]) continue;
            if (p.Values[5] == 1)
            {
                if (p.Values[6] is not { } generation || !double.IsFinite(generation) || generation < 0) continue;
                bool Fresh(PowerFrame frame, int index) => frame.Values[index] is { } watts && double.IsFinite(watts) && watts >= 0
                    && frame.Received[index] is { } received && received >= 0
                    && received < (frame.Time + Policy.SampleSeconds) * 1000
                    && frame.Time * 1000 - received <= CopPolicy.MaxAgeSeconds * 1000L;
                bool Valid(int index) => Fresh(p, index) && Fresh(current, index)
                    && current.Time * 1000 - p.Received[index] <= CopPolicy.MaxAgeSeconds * 1000L;
                bool Paired(PowerFrame frame) => frame.Received[3].HasValue && frame.Received[4].HasValue
                    && Math.Abs(frame.Received[3]!.Value - frame.Received[4]!.Value) <= maxPairSeconds * 1000L;
                var heatpump = Valid(3); var heater = Valid(4);
                if (heatpump || heater) calendar.Sources.Add("alternative-mqtt");
                calendar.Add(p.Time * 1000, current.Time * 1000,
                    [p.Values[3] ?? 0, p.Values[4] ?? 0, (p.Values[3] ?? 0) + (p.Values[4] ?? 0)],
                    [heatpump, heater, heatpump && heater && Paired(p) && Paired(current)]);
            }
            else if (p.Values[5] == 0 && p.Values[6] is >= 0
                || !lastRaw.HasValue && (!firstMarker.HasValue || current.Time < firstMarker.Value))
            {
                var mode = p.EnergyMode(maxPairSeconds);
                if (mode >= 0 && mode == current.EnergyMode(maxPairSeconds))
                {
                    calendar.Sources.Add("heishamon-extra");
                    calendar.Add(p.Time * 1000, current.Time * 1000, [0, 0, p.Values.Take(3).Sum(v => v!.Value)], [false, false, true]);
                }
            }
        }
    }

    private sealed class MeterEnergyCalendar
    {
        private readonly int year;
        private readonly SourceKind source;
        private readonly DateTimeOffset now;
        private readonly DateTimeOffset[] bounds;
        private readonly long[] milliseconds;
        private readonly double[,] energy;
        private readonly double[,] duration;
        public HashSet<string> Sources { get; } = [];
        public long First => milliseconds[0];
        public long Last => milliseconds[^1];

        public MeterEnergyCalendar(int year, SourceKind source, DateTimeOffset now)
        {
            this.year = year; this.source = source; this.now = now;
            var first = new DateOnly(year, 1, 1);
            var count = DateTime.IsLeapYear(year) ? 366 : 365;
            bounds = Enumerable.Range(0, count + 1).Select(i => EnergyCalendar.Midnight(first.AddDays(i))).ToArray();
            milliseconds = bounds.Select(b => b.ToUnixTimeMilliseconds()).ToArray();
            energy = new double[count, 3]; duration = new double[count, 3];
        }

        public void Add(long start, long end, double[] watts, bool[] valid)
        {
            start = Math.Max(start, First); end = Math.Min(end, Math.Min(Last, now.ToUnixTimeMilliseconds()));
            var index = Array.BinarySearch(milliseconds, start);
            var day = index >= 0 ? index : ~index - 1;
            while (start < end && day < bounds.Length - 1)
            {
                var stop = Math.Min(end, milliseconds[day + 1]);
                var seconds = (stop - start) / 1000d;
                for (var channel = 0; channel < 3; channel++)
                {
                    var sum = energy[day, channel] + watts[channel] * seconds / 3600000;
                    if (valid[channel] && double.IsFinite(sum)) { energy[day, channel] = sum; duration[day, channel] += seconds; }
                }
                start = stop; day++;
            }
        }

        public EnergyResult Result(int sampleSeconds)
        {
            var first = new DateOnly(year, 1, 1);
            return new(year, source, Catalog.KilowattHour, "Europe/Berlin", Enumerable.Range(0, bounds.Length - 1).Select(i => {
                var expected = (bounds[i + 1] - bounds[i]).TotalSeconds;
                var status = bounds[i] > now ? "future" : bounds[i + 1] > now ? "current"
                    : Math.Abs(duration[i, 2] - expected) < .001 ? "complete" : duration[i, 2] > 0 ? "partial" : "missing";
                return new EnergyDay(first.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), bounds[i], bounds[i + 1],
                    duration[i, 2] > 0 ? energy[i, 2] : null, duration[i, 2], expected, status) {
                    HeatpumpKwh = duration[i, 0] > 0 ? energy[i, 0] : null, HeaterKwh = duration[i, 1] > 0 ? energy[i, 1] : null,
                    HeatpumpValidSeconds = duration[i, 0], HeaterValidSeconds = duration[i, 1] };
            }).ToArray()) { ElectricalSource = Sources.Count > 1 ? "mixed" : Sources.FirstOrDefault() ?? "alternative-mqtt",
                MaxGapSeconds = Sources.SetEquals(["shelly-ac"]) ? 20 : sampleSeconds };
        }
    }
}
