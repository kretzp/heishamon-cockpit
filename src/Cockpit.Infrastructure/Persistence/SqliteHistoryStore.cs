using System.Globalization;
using System.Text;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Cockpit.Infrastructure.Persistence;

public sealed partial class SqliteHistoryStore : IHistoryStore, IDisposable
{
    private readonly string path;
    private readonly SourceKind source;
    private readonly DbContextOptions<HistoryDb> options;
    private readonly SemaphoreSlim writer = new(1, 1);
    private readonly SemaphoreSlim readers = new(2, 2);
    private FileStream? lease;
    private Snapshot? previous;
    public HistoryPolicy Policy { get; }
    public SqliteHistoryStore(string path, SourceKind source, HistoryPolicy policy)
    {
        policy.Validate();
        this.path = Path.GetFullPath(path);
        this.source = source;
        Policy = policy;
        options = new DbContextOptionsBuilder<HistoryDb>().UseSqlite(new SqliteConnectionStringBuilder
        { DataSource = this.path, DefaultTimeout = 5 }.ToString(), sqlite => sqlite.CommandTimeout(15)).Options;
    }
    public async Task InitializeAsync(CancellationToken token)
    {
        // EF's SQLite migration lock retry has no command timeout. Bound the entire
        // initialization attempt; HistoryWorker reports failed and retries on timeout.
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        token = deadline.Token;
        await writer.WaitAsync(token);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            lease ??= new FileStream(path + ".writer.lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            await using var db = new HistoryDb(options);
            // Normal restarts do not need a migration lock. In particular, a stale
            // EF lock must not block recording against an already current schema.
            // Keep EF locking for actual migrations; never delete another owner's lock.
            if ((await db.Database.GetPendingMigrationsAsync(token)).Any())
                await db.Database.MigrateAsync(token);
            await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", token);
            var metadata = await db.Metadata.SingleOrDefaultAsync(token);
            if (metadata is null)
            {
                db.Metadata.Add(new() { Id = 1, Source = source.ToString(), SampleSeconds = Policy.SampleSeconds });
                await db.SaveChangesAsync(token);
            }
            else if (metadata.Source != source.ToString() || metadata.SampleSeconds != Policy.SampleSeconds)
                throw new InvalidOperationException("Database source or sampling interval mismatch; use a separate database.");
        }
        finally { writer.Release(); }
    }
    public async Task CaptureAsync(Snapshot snapshot, bool sample, CancellationToken token)
    {
        if (snapshot.Values.Any(v => v.SourceKind != source)) throw new InvalidOperationException("Source mismatch.");
        await writer.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            await using var transaction = await db.Database.BeginTransactionAsync(token);
            var now = snapshot.GeneratedAtUtc.ToUnixTimeSeconds();
            var slot = now / Policy.SampleSeconds * Policy.SampleSeconds;
            if (sample)
                foreach (var v in snapshot.Values)
                {
                    double? number = v.Quality == Quality.Valid ? v.Value switch { double d when double.IsFinite(d) => d, int i => i, _ => null } : null;
                    string? text = v.Quality == Quality.Valid ? v.Value as string : null;
                    await db.Database.ExecuteSqlInterpolatedAsync($"INSERT OR IGNORE INTO Samples (Key,Time,Value,Text,Quality,Received,Retained) VALUES ({v.Key},{slot},{number},{text},{(int)v.Quality},{(v.ReceivedAtUtc.HasValue ? v.ReceivedAtUtc.Value.ToUnixTimeMilliseconds() : (long?)null)},{v.Retained})", token);
                }
            void Add(string kind, string key, string message) => db.Events.Add(new() { Time = now, Kind = kind, Key = key, Message = message });
            foreach (var diagnostic in snapshot.Diagnostics)
            {
                var recordedCount = previous?.InstanceId == snapshot.InstanceId
                    ? previous.Diagnostics.FirstOrDefault(d => d.Key == diagnostic.Key)?.Count ?? 0 : 0;
                var occurrences = diagnostic.Count - recordedCount;
                if (occurrences > 0)
                    db.Events.Add(new() { Time = diagnostic.Time.ToUnixTimeSeconds(), Kind = "quality", Key = diagnostic.Key,
                        Message = diagnostic.Message + (occurrences > 1 ? " Fälle seit letzter Aufzeichnung: " + occurrences + "." : "") });
            }
            if (previous is null) Add("system", "recorder", "Aufzeichnung gestartet; Quelle: " + source);
            if (previous is null || previous.BrokerConnected != snapshot.BrokerConnected)
                Add("connection", "broker", snapshot.BrokerConnected ? "Broker verbunden" : "Broker getrennt");
            if (previous is null || previous.DeviceAvailability != snapshot.DeviceAvailability)
                Add("connection", "device", "Geräteverfügbarkeit: " + snapshot.DeviceAvailability);
            foreach (var v in snapshot.Values)
            {
                var old = previous?.Values.FirstOrDefault(x => x.Key == v.Key);
                if (old is null || old.Quality != v.Quality) Add("quality", v.Key, "Datenqualität: " + v.Quality + " · Wert: " + EventValue(v));
                if (v.Key == "activeError" && (old is null || !Equals(old.Value, v.Value)))
                    Add("error", v.Key, Equals(v.Value, Catalog.NoError) ? "Fehlerstatus: " + EventValue(v) : v.Value is string code ? "Gemeldeter Fehler: " + code : "Fehlerstatus unbekannt");
                if (v.Quality == Quality.Valid && (old is null || !Equals(old.Value, v.Value))
                    && HistoryQuery.Metrics.TryGetValue(v.Key, out var metric) && metric.Type == "enum")
                    Add("state", v.Key, "Beobachteter Zustand: " + EventValue(v));
            }
            await db.SaveChangesAsync(token);
            await transaction.CommitAsync(token);
            previous = snapshot;
        }
        finally { writer.Release(); }
    }
    private static string EventValue(TelemetryValue value)
    {
        if (value.Value is null || value.Quality is Quality.Unknown or Quality.Invalid) return "—";
        string text;
        if (value.Value is int state && value.Unit == "enum")
        {
            string[] names = value.Key switch
            {
                "quietMode" => ["Aus", "Stufe 1", "Stufe 2", "Stufe 3"],
                "operatingMode" => ["Heizen", "Kühlen", "Auto (Heizen)", "Warmwasser", "Heizen + Warmwasser", "Kühlen + Warmwasser", "Auto (Heizen) + Warmwasser", "Auto (Kühlen)", "Auto (Kühlen) + Warmwasser"],
                "threeWayValveState" => ["Raumheizung", "Warmwasser"],
                "heatingControlMode" => ["Heizkurve", "Festwert"],
                "zone1SensorMode" => ["Wasser", "Externer Thermostat", "Interner Thermostat/Thermistor"],
                "heatpumpState" or "internalHeaterState" or "defrostState" => ["Aus", "Ein"],
                _ => []
            };
            text = state >= 0 && state < names.Length ? names[state] + " (" + state + ")" : state.ToString(CultureInfo.InvariantCulture);
        }
        else text = value.Value switch
        {
            double d when double.IsFinite(d) => d.ToString(value.Key == "waterPressure" ? "0.00" : "0.################", CultureInfo.GetCultureInfo("de-DE")),
            string code => value.Key == "activeError" && code == Catalog.NoError ? "Fehlerfrei" : code,
            int i => i.ToString(CultureInfo.GetCultureInfo("de-DE")),
            _ => "—"
        };
        if (text != "—" && value.Unit is not "" and not "enum") text += " " + value.Unit;
        if (value.Quality == Quality.Stale) text += " (veraltet)";
        if (value.Retained) text += " (retained)";
        return text;
    }
    public async Task<int> PruneAsync(DateTimeOffset now, CancellationToken token)
    {
        await writer.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            var cutoff = now.AddDays(-Policy.RetentionDays).ToUnixTimeSeconds();
            // Bound each maintenance batch; freed SQLite pages are reused, not vacuumed on every pass.
            var count = await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM Samples WHERE rowid IN (SELECT rowid FROM Samples WHERE Time < {cutoff} LIMIT 10000)", token);
            count += await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM Events WHERE Id IN (SELECT Id FROM Events WHERE Time < {cutoff} LIMIT 10000)", token);
            return count;
        }
        finally { writer.Release(); }
    }
    private static long CeilingSeconds(DateTimeOffset time) => time.ToUnixTimeSeconds() + (time.Ticks % TimeSpan.TicksPerSecond == 0 ? 0 : 1);
    public async Task<HistoryResult> QueryAsync(HistoryQuery query, CancellationToken token)
        => await QueryCoreAsync(query, false, token);
    private async Task<HistoryResult> QueryCoreAsync(HistoryQuery query, bool excludeRetained, CancellationToken token)
    {
        query.Validate(Policy);
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            await db.Database.OpenConnectionAsync(token);
            var all = new List<HistorySeries>();
            long from = CeilingSeconds(query.From), to = CeilingSeconds(query.To), width = query.BucketSeconds;
            foreach (var key in query.Keys)
            {
                var metric = HistoryQuery.FindMetric(key)!;
                await using var command = db.Database.GetDbConnection().CreateCommand();
                command.CommandTimeout = 15;
                command.CommandText = """
                    SELECT (Time / $width) * $width AS Bucket, COUNT(*),
                        SUM(CASE WHEN Quality=1 AND Value IS NOT NULL AND ($strict=0 OR Retained=0) THEN 1 ELSE 0 END),
                        AVG(Value), MIN(Value), MAX(Value), MAX(Quality)
                    FROM Samples WHERE Key=$key AND Time >= $from AND Time < $to
                    GROUP BY Bucket ORDER BY Bucket
                    """;
                foreach (var (name, value) in new (string, object)[] { ("$width", width), ("$key", key), ("$from", from), ("$to", to), ("$strict", excludeRetained ? 1 : 0) })
                { var parameter = command.CreateParameter(); parameter.ParameterName = name; parameter.Value = value; command.Parameters.Add(parameter); }
                var buckets = new Dictionary<long, HistoryPoint>();
                await using (var reader = await command.ExecuteReaderAsync(token))
                    while (await reader.ReadAsync(token))
                    {
                        var time = reader.GetInt64(0);
                        var count = reader.GetInt32(1);
                        var expected = (Math.Min(to, time + width) + Policy.SampleSeconds - 1) / Policy.SampleSeconds
                            - (Math.Max(from, time) + Policy.SampleSeconds - 1) / Policy.SampleSeconds;
                        var complete = count == expected && reader.GetInt32(2) == count;
                        var stable = metric.Type != "enum" || (!reader.IsDBNull(4) && reader.GetDouble(4) == reader.GetDouble(5));
                        double? value = complete && stable && !reader.IsDBNull(3) ? reader.GetDouble(3) : null;
                        if (value.HasValue && !double.IsFinite(value.Value)) value = null;
                        var quality = value.HasValue ? Quality.Valid : (Quality)reader.GetInt32(6);
                        if (quality == Quality.Valid) quality = Quality.Unknown;
                        if (value.HasValue) quality = Quality.Valid;
                        buckets[time] = new(DateTimeOffset.FromUnixTimeSeconds(time), value, quality, count);
                    }
                var points = new List<HistoryPoint>();
                for (var t = from / width * width; t < to; t += width)
                    points.Add(buckets.GetValueOrDefault(t) ?? new(DateTimeOffset.FromUnixTimeSeconds(t), null, Quality.Unknown, 0));
                all.Add(new(key, metric.Unit, source, metric.Type == "enum" ? "stableState" : "mean", points));
            }
            return new(query.From.ToUniversalTime(), query.To.ToUniversalTime(), query.BucketSeconds, all);
        }
        finally { readers.Release(); }
    }
    public async Task<EventPage> EventsAsync(long? cursor, string? kind, CancellationToken token)
    {
        if (cursor is <= 0 || (kind is not null && !new[] { "system", "connection", "quality", "error", "state" }.Contains(kind)))
            throw new HistoryRequestException("invalid_event_filter", "Ungültiger Ereignisfilter oder Cursor.");
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            var query = db.Events.AsNoTracking().AsQueryable();
            if (cursor.HasValue) query = query.Where(x => x.Id < cursor.Value);
            if (kind is not null) query = query.Where(x => x.Kind == kind);
            var rows = await query.OrderByDescending(x => x.Id).Take(101).ToListAsync(token);
            return new(rows.Take(100).Select(x => new RecordedEvent(x.Id, DateTimeOffset.FromUnixTimeSeconds(x.Time), x.Kind, x.Key, x.Message, source)).ToArray(), rows.Count > 100 ? rows[99].Id : null);
        }
        finally { readers.Release(); }
    }
    public static string CsvCell(string text)
    {
        if (text.Length > 0 && ("=+-@".Contains(text.TrimStart().FirstOrDefault()) || text[0] is '\t' or '\r' or '\n')) text = "'" + text;
        return "\"" + text.Replace("\"", "\"\"") + "\"";
    }
    public async Task<string> ExportAsync(HistoryQuery query, CancellationToken token)
    {
        query.Validate(Policy, export: true);
        await readers.WaitAsync(token);
        try
        {
            await using var db = new HistoryDb(options);
            long from = CeilingSeconds(query.From), to = CeilingSeconds(query.To);
            var rows = await db.Samples.AsNoTracking().Where(x => query.Keys.Contains(x.Key) && x.Time >= from && x.Time < to)
                .OrderBy(x => x.Time).ThenBy(x => x.Key).Take(100001).ToListAsync(token);
            if (rows.Count > 100000) throw new HistoryRequestException("export_too_large", "CSV ist auf 100.000 Zeilen begrenzt. Bitte kürzeren Zeitraum oder weniger Messwerte wählen.");
            var csv = new StringBuilder("timeUtc;key;value;unit;quality;source;receivedAtUtc;retained\r\n");
            foreach (var row in rows)
            {
                var fields = new[] { DateTimeOffset.FromUnixTimeSeconds(row.Time).ToString("O"), row.Key,
                    row.Text ?? row.Value?.ToString("R", CultureInfo.InvariantCulture).Replace('.', ',') ?? "", HistoryQuery.FindMetric(row.Key)!.Unit,
                    ((Quality)row.Quality).ToString().ToLowerInvariant(), source.ToString().ToLowerInvariant(),
                    row.Received.HasValue ? DateTimeOffset.FromUnixTimeMilliseconds(row.Received.Value).ToString("O") : "", row.Retained ? "true" : "false" };
                // Numeric negative values are generated from doubles, never untrusted spreadsheet formulas.
                csv.AppendJoin(';', fields.Select((value, i) => i == 2 && row.Value.HasValue ? value : CsvCell(value))).Append("\r\n");
            }
            return csv.ToString();
        }
        finally { readers.Release(); }
    }
    public async Task BackupAsync(string destination, CancellationToken token)
    {
        await writer.WaitAsync(token);
        try
        {
            if (File.Exists(destination)) throw new IOException("Backup destination already exists.");
            await using var db = new HistoryDb(options);
            await db.Database.OpenConnectionAsync(token);
            await using var target = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = destination }.ToString());
            await target.OpenAsync(token);
            ((SqliteConnection)db.Database.GetDbConnection()).BackupDatabase(target);
        }
        finally { writer.Release(); }
    }
    public void Dispose() { lease?.Dispose(); writer.Dispose(); readers.Dispose(); }
}
