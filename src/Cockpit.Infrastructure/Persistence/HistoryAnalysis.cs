using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.EntityFrameworkCore;

namespace Cockpit.Infrastructure.Persistence;

public sealed partial class SqliteHistoryStore
{
    public async Task<TemperaturePairResult> PairsAsync(HistoryQuery query, int maxPairSeconds, CancellationToken token)
    {
        query.Validate(Policy);
        if (query.Keys.Length != 2 || !query.Keys.Contains("flowTemperature") || !query.Keys.Contains("returnTemperature"))
            throw new HistoryRequestException("invalid_keys", "Spreizungsband benötigt Vorlauf und Rücklauf.");
        if (maxPairSeconds is < 0 or > 3600) throw new ArgumentOutOfRangeException(nameof(maxPairSeconds));
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            await db.Database.OpenConnectionAsync(token);
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandTimeout = 15;
            command.CommandText = """
                WITH Pairs AS (
                    SELECT f.Time, f.Value AS Flow, r.Value AS ReturnValue,
                        CASE WHEN f.Quality=1 AND r.Quality=1 AND f.Retained=0 AND r.Retained=0
                            AND f.Value IS NOT NULL AND r.Value IS NOT NULL
                            AND f.Received IS NOT NULL AND r.Received IS NOT NULL
                            AND ABS(f.Received-r.Received) <= $skew THEN 1 ELSE 0 END AS Valid
                    FROM Samples f LEFT JOIN Samples r ON r.Key='returnTemperature' AND r.Time=f.Time
                    WHERE f.Key='flowTemperature' AND f.Time >= $from AND f.Time < $to
                )
                SELECT (Time/$width)*$width, SUM(Valid),
                    AVG(CASE WHEN Valid=1 THEN Flow END), AVG(CASE WHEN Valid=1 THEN ReturnValue END)
                FROM Pairs GROUP BY (Time/$width)*$width ORDER BY Time
                """;
            long from = CeilingSeconds(query.From), to = CeilingSeconds(query.To), width = query.BucketSeconds;
            foreach (var (name, value) in new (string, object)[] { ("$from", from), ("$to", to), ("$width", width), ("$skew", maxPairSeconds * 1000L) })
            { var p = command.CreateParameter(); p.ParameterName = name; p.Value = value; command.Parameters.Add(p); }
            var buckets = new Dictionary<long, (int Count, double? Flow, double? Return)>();
            await using (var reader = await command.ExecuteReaderAsync(token))
                while (await reader.ReadAsync(token))
                    buckets[reader.GetInt64(0)] = (reader.GetInt32(1), reader.IsDBNull(2) ? null : reader.GetDouble(2), reader.IsDBNull(3) ? null : reader.GetDouble(3));
            var points = new List<TemperaturePairPoint>();
            for (var t = from / width * width; t < to; t += width)
            {
                var expected = (int)((Math.Min(to, t + width) + Policy.SampleSeconds - 1) / Policy.SampleSeconds
                    - (Math.Max(from, t) + Policy.SampleSeconds - 1) / Policy.SampleSeconds);
                var b = buckets.GetValueOrDefault(t);
                var valid = expected > 0 && b.Count == expected && b.Flow.HasValue && b.Return.HasValue
                    && double.IsFinite(b.Flow.Value) && double.IsFinite(b.Return.Value) && double.IsFinite(b.Flow.Value - b.Return.Value);
                points.Add(new(DateTimeOffset.FromUnixTimeSeconds(t), valid ? b.Flow : null, valid ? b.Return : null,
                    valid ? b.Flow - b.Return : null, valid ? Quality.Valid : Quality.Unknown, b.Count, expected));
            }
            return new(query.From.ToUniversalTime(), query.To.ToUniversalTime(), query.BucketSeconds, source, maxPairSeconds, points);
        }
        finally { readers.Release(); }
    }

    private static readonly HashSet<string> TimelineKeys = ["heatpumpState", "operatingMode", "internalHeaterState", "defrostState", "threeWayValveState", "sterilizationState"];
    public async Task<StateIntervalResult> IntervalsAsync(HistoryQuery query, CancellationToken token)
    {
        query.Validate(Policy);
        if (query.Keys.Any(k => !TimelineKeys.Contains(k)))
            throw new HistoryRequestException("invalid_keys", "Bitte ausschließlich unterstützte Betriebszustände wählen.");
        var series = new List<StateIntervalSeries>();
        bool fallback = false;
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            var step = Policy.SampleSeconds;
            var from = query.From.ToUnixTimeSeconds() / step * step - step;
            var to = CeilingSeconds(query.To) + step;
            var remaining = 100000;
            foreach (var key in query.Keys)
            {
                var rows = await db.Samples.AsNoTracking().Where(s => s.Key == key && s.Time >= from && s.Time < to)
                    .OrderBy(s => s.Time).Take(remaining + 1).ToListAsync(token);
                remaining -= rows.Count;
                if (remaining < 0) { fallback = true; break; }
                var intervals = BuildIntervals(rows, query, step, HistoryQuery.Metrics[key].MaxEnum);
                series.Add(new(key, "enum", source, "observedIntervals", [], intervals));
                if (series.Sum(s => s.Intervals.Count) > 20000) { fallback = true; break; }
            }
        }
        finally { readers.Release(); }
        if (!fallback) return new(query.From.ToUniversalTime(), query.To.ToUniversalTime(), Policy.SampleSeconds, Policy.SampleSeconds, "sampled", series);
        // Release the reader lease before reusing the existing bounded aggregation.
        var coarse = await QueryCoreAsync(query, true, token);
        return new(query.From.ToUniversalTime(), query.To.ToUniversalTime(), query.BucketSeconds, Policy.SampleSeconds, "bucketed",
            coarse.Series.Select(s => new StateIntervalSeries(s.Key, s.Unit, s.Source, "observedIntervals", [],
                BuildIntervals(s.Points.Select(p => new SampleRow { Time = p.Time.ToUnixTimeSeconds(), Value = p.Value,
                    Quality = (int)p.Quality }).ToList(), query, query.BucketSeconds, HistoryQuery.Metrics[s.Key].MaxEnum, false))).ToArray());
    }

    private static IReadOnlyList<StateInterval> BuildIntervals(List<SampleRow> rows, HistoryQuery query, int step, int maxEnum, bool observed = true)
    {
        bool Valid(SampleRow r) => r.Quality == (int)Quality.Valid && !r.Retained && r.Value is double v
            && double.IsFinite(v) && v >= 0 && v <= maxEnum && v == Math.Truncate(v);
        var result = new List<StateInterval>();
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (!Valid(row)) continue;
            var start = DateTimeOffset.FromUnixTimeSeconds(row.Time);
            var end = start.AddSeconds(step);
            if (end <= query.From || start >= query.To) continue;
            var startObserved = observed && start >= query.From && i > 0 && Valid(rows[i - 1])
                && rows[i - 1].Time + step == row.Time && rows[i - 1].Value != row.Value;
            var endObserved = observed && end <= query.To && i + 1 < rows.Count && Valid(rows[i + 1])
                && row.Time + step == rows[i + 1].Time && rows[i + 1].Value != row.Value;
            if (start < query.From) start = query.From;
            if (end > query.To) end = query.To;
            var last = result.LastOrDefault();
            if (last is not null && last.To == start && last.Value == row.Value)
                result[^1] = last with { To = end, EndObserved = endObserved };
            else result.Add(new(start, end, (int)row.Value!.Value, Quality.Valid, startObserved, endObserved));
        }
        return result;
    }
}
