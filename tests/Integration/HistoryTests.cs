using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Cockpit.Integration;

public sealed class HistoryTests : IDisposable
{
    private readonly string folder = Path.Combine(Path.GetTempPath(), "cockpit-history-" + Guid.NewGuid().ToString("N"));
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
    private SqliteHistoryStore Open(string name = "test.db") => new(Path.Combine(folder, name), SourceKind.Simulator, new());
    private static Snapshot Frame(DateTimeOffset time, Quality quality = Quality.Valid, double value = 20) =>
        new(1, Guid.NewGuid(), time, true, Availability.Online, quality,
            [new("flowTemperature", value, "°C", quality, time.AddSeconds(-5), null, false, "main/Main_Outlet_Temp", SourceKind.Simulator)]);
    private static HistoryQuery Query(DateTimeOffset from, int seconds = 30, int bucket = 30) => new(["flowTemperature"], from, from.AddSeconds(seconds), bucket);
    [Theory]
    [InlineData("pumpSpeed", "main/Pump_Speed", "1750.25", 1750.25, "U/min")]
    [InlineData("fanSpeed", "main/Fan1_Motor_Speed", "0", 0, "U/min")]
    [InlineData("compressorCurrent", "main/Compressor_Current", "4.44", 4.44, "A")]
    [InlineData("highPressure", "main/High_Pressure", "10.24", 10.24, "kgf/cm²")]
    public async Task TechnicalValuesSurviveRestartAndExportWithoutRounding(string key, string suffix, string payload, double expected, string unit)
    {
        var telemetry = new TelemetryStore(SourceKind.Simulator);
        telemetry.SetConnection(true); telemetry.Receive(suffix, payload);
        var snapshot = telemetry.Read() with { GeneratedAtUtc = Start };
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            await store.CaptureAsync(snapshot, true, default);
            await store.CaptureAsync(snapshot with { GeneratedAtUtc = Start.AddSeconds(30), Values = snapshot.Values.Select(v => v with { Quality = Quality.Stale }).ToArray() }, true, default);
        }
        using var reopened = Open(); await reopened.InitializeAsync(default);
        var query = new HistoryQuery([key], Start, Start.AddSeconds(60), 30);
        query.Validate(new());
        var result = (await reopened.QueryAsync(query, default)).Series.Single();
        Assert.Equal(unit, result.Unit); Assert.Equal(expected, result.Points[0].Value);
        Assert.Null(result.Points[1].Value); Assert.Equal(Quality.Stale, result.Points[1].Quality);
        var csv = await reopened.ExportAsync(query, default);
        Assert.Contains(";" + payload.Replace('.', ',') + ";\"" + unit + "\";\"valid\";", csv);
        Assert.Contains(";\"\";\"" + unit + "\";\"stale\";", csv);
    }
    [Fact]
    public async Task HeishamonCopHistoryPreservesValuesGapsAndCsvAcrossRestart()
    {
        Snapshot CopFrame(DateTimeOffset time, Quality quality, double? value) => Frame(time) with {
            Values = [new("heishamonCop", value, "", quality, time, null, false, null, SourceKind.Simulator)] };
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            await store.CaptureAsync(CopFrame(Start, Quality.Valid, 4.25), true, default);
            await store.CaptureAsync(CopFrame(Start.AddSeconds(30), Quality.Unknown, null), true, default);
        }
        using var reopened = Open(); await reopened.InitializeAsync(default);
        var query = new HistoryQuery(["heishamonCop"], Start, Start.AddSeconds(60), 30);
        var series = Assert.Single((await reopened.QueryAsync(query, default)).Series);
        Assert.Equal("", series.Unit); Assert.Equal(4.25, series.Points[0].Value);
        Assert.Null(series.Points[1].Value); Assert.Equal(Quality.Unknown, series.Points[1].Quality);
        Assert.Contains(";4,25;", await reopened.ExportAsync(query, default));
    }
    [Fact]
    public async Task RestartMigrationAndConsistentBackupPreserveData()
    {
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            await store.CaptureAsync(Frame(Start), true, default);
            await store.BackupAsync(Path.Combine(folder, "backup.db"), default);
        }
        using var restarted = Open();
        await restarted.InitializeAsync(default);
        Assert.Equal(20, (await restarted.QueryAsync(Query(Start), default)).Series[0].Points[0].Value);
        using var restored = Open("backup.db");
        await restored.InitializeAsync(default);
        Assert.Equal(20, (await restored.QueryAsync(Query(Start), default)).Series[0].Points[0].Value);
        Assert.Contains((await restored.EventsAsync(null, null, default)).Items, e => e.Kind == "system");
    }
    private async Task SeedMigrationLock(bool migrated)
    {
        if (migrated)
        {
            using var store = Open();
            await store.InitializeAsync(default);
            await store.CaptureAsync(Frame(Start), true, default);
        }
        Directory.CreateDirectory(folder);
        await using var connection = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS "__EFMigrationsLock" (
                "Id" INTEGER NOT NULL PRIMARY KEY, "Timestamp" TEXT NOT NULL);
            INSERT INTO "__EFMigrationsLock" VALUES (1, '2026-09-20 08:08:51.8042089+00:00');
            """;
        await command.ExecuteNonQueryAsync();
    }
    private async Task AssertMigrationLockPreserved()
    {
        await using var connection = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """SELECT "Timestamp" FROM "__EFMigrationsLock" WHERE "Id"=1""";
        Assert.Equal("2026-09-20 08:08:51.8042089+00:00", await command.ExecuteScalarAsync());
    }
    [Fact]
    public async Task CurrentSchemaStartsDespiteAbandonedMigrationLockAndPreservesHistory()
    {
        await SeedMigrationLock(migrated: true);
        using var store = Open();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        await store.InitializeAsync(deadline.Token);
        Assert.Equal(20, (await store.QueryAsync(Query(Start), default)).Series[0].Points[0].Value);
        await store.CaptureAsync(Frame(Start.AddSeconds(30), value: 21), true, default);
        Assert.Equal(21, (await store.QueryAsync(Query(Start.AddSeconds(30)), default)).Series[0].Points[0].Value);
        await AssertMigrationLockPreserved();
        using var second = Open();
        await Assert.ThrowsAsync<IOException>(() => second.InitializeAsync(default));
    }
    [Fact]
    public async Task PendingMigrationHonorsCancellationWithoutStealingLock()
    {
        await SeedMigrationLock(migrated: false);
        using var store = Open();
        using var deadline = new CancellationTokenSource(TimeSpan.FromMilliseconds(300));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.InitializeAsync(deadline.Token));
        await AssertMigrationLockPreserved();
        // Simulate the other migration owner releasing its lock, then retry on the same store.
        await using (var connection = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}"))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = """DELETE FROM "__EFMigrationsLock" WHERE "Id"=1""";
            await command.ExecuteNonQueryAsync();
        }
        await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(Start), true, default);
        Assert.Equal(20, (await store.QueryAsync(Query(Start), default)).Series[0].Points[0].Value);
    }
    [Fact]
    public async Task PendingMigrationTimesOutWithoutCallerDeadlineAndPreservesLock()
    {
        await SeedMigrationLock(migrated: false);
        using var store = Open();
        // The outer deadline is a test guard, not the initialization cancellation token.
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => store.InitializeAsync(default).WaitAsync(TimeSpan.FromSeconds(40)));
        await AssertMigrationLockPreserved();
    }
    [Fact]
    public async Task GapsAndStaleValuesNeverBecomeValidAggregates()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(Start), true, default);
        await store.CaptureAsync(Frame(Start.AddSeconds(60), Quality.Stale, 99), true, default);
        var points = (await store.QueryAsync(Query(Start, 90), default)).Series[0].Points;
        Assert.Equal(20, points[0].Value);
        Assert.Null(points[1].Value);
        Assert.Equal(0, points[1].Samples);
        Assert.Null(points[2].Value);
        Assert.Equal(Quality.Stale, points[2].Quality);
        Assert.Null((await store.QueryAsync(Query(Start, 90, 90), default)).Series[0].Points[0].Value);
        var csv = await store.ExportAsync(Query(Start, 90), default);
        Assert.Contains("stale", csv);
        Assert.DoesNotContain(";99;", csv);
    }
    [Fact]
    public async Task AggregatesCompleteBucketsAndKeepsUtcAndOriginalReception()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(Start.ToOffset(TimeSpan.FromHours(2)), value: 20), true, default);
        await store.CaptureAsync(Frame(Start.AddSeconds(30), value: 24), true, default);
        var point = (await store.QueryAsync(Query(Start, 60, 60), default)).Series[0].Points[0];
        Assert.Equal(22, point.Value);
        Assert.Equal(2, point.Samples);
        Assert.Equal(TimeSpan.Zero, point.Time.Offset);
        var csv = await store.ExportAsync(Query(Start, 60), default);
        Assert.Contains("2025-12-31T23:59:55.0000000+00:00", csv);
    }
    [Fact]
    public async Task RetentionKeepsExactly700DaysAndPrunesOlderSamplesAndEvents()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(Start.AddSeconds(-30)), true, default);
        await store.CaptureAsync(Frame(Start, Quality.Stale), true, default);
        Assert.True(await store.PruneAsync(Start.AddDays(700), default) > 0);
        var points = (await store.QueryAsync(Query(Start.AddSeconds(-30), 60), default)).Series[0].Points;
        Assert.Equal(0, points[0].Samples);
        Assert.Equal(1, points[1].Samples);
        Assert.All((await store.EventsAsync(null, null, default)).Items, e => Assert.True(e.Time >= Start));
    }
    [Fact]
    public async Task EventsAreDeduplicatedFilteredAndCursorPaged()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        var frame = Frame(Start);
        await store.CaptureAsync(frame, true, default);
        var count = (await store.EventsAsync(null, null, default)).Items.Count;
        await store.CaptureAsync(frame, true, default);
        Assert.Equal(count, (await store.EventsAsync(null, null, default)).Items.Count);
        for (var i = 1; i <= 110; i++) await store.CaptureAsync(Frame(Start.AddSeconds(i), i % 2 == 0 ? Quality.Valid : Quality.Stale), false, default);
        var page = await store.EventsAsync(null, "quality", default);
        Assert.Equal(100, page.Items.Count);
        Assert.NotNull(page.NextCursor);
        var second = await store.EventsAsync(page.NextCursor, "quality", default);
        Assert.NotEmpty(second.Items);
        Assert.Empty(page.Items.Select(x => x.Id).Intersect(second.Items.Select(x => x.Id)));
    }
    [Fact]
    public async Task DatabaseRejectsMixedSourcesAndSecondWriter()
    {
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            using var second = Open();
            await Assert.ThrowsAsync<IOException>(() => second.InitializeAsync(default));
            var otherFrame = Frame(Start) with { Values = [Frame(Start).Values[0] with { SourceKind = SourceKind.Mqtt }] };
            await Assert.ThrowsAsync<InvalidOperationException>(() => store.CaptureAsync(otherFrame, true, default));
        }
        using var other = new SqliteHistoryStore(Path.Combine(folder, "test.db"), SourceKind.Mqtt, new());
        await Assert.ThrowsAsync<InvalidOperationException>(() => other.InitializeAsync(default));
    }
    [Fact]
    public void QueryBoundsProtect700DayHistoryAndRawExport()
    {
        var policy = new HistoryPolicy();
        new HistoryQuery(["flowTemperature"], Start, Start.AddDays(700), 86400).Validate(policy);
        Assert.Throws<HistoryRequestException>(() => new HistoryQuery(["flowTemperature"], Start, Start.AddDays(701), 86400).Validate(policy));
        Assert.Throws<HistoryRequestException>(() => new HistoryQuery(["flowTemperature"], Start, Start.AddDays(700), 30).Validate(policy));
        Assert.Throws<HistoryRequestException>(() => new HistoryQuery(["flowTemperature"], Start, Start.AddDays(31), 30).Validate(policy, true));
        Assert.Throws<HistoryRequestException>(() => new HistoryQuery(["unknown"], Start, Start.AddSeconds(30), 30).Validate(policy));
        Assert.Throws<HistoryRequestException>(() => Query(Start, 60, 31).Validate(policy));
        Assert.Throws<ArgumentException>(() => new HistoryPolicy(RetentionDays: 701).Validate());
    }
    [Theory]
    [InlineData("=1+1")]
    [InlineData("  @SUM(A1)")]
    [InlineData("+cmd")]
    [InlineData("-cmd")]
    [InlineData("\tformula")]
    public void CsvTextCannotStartSpreadsheetFormulas(string value) => Assert.StartsWith("\"'", SqliteHistoryStore.CsvCell(value));
    [Fact]
    public async Task Full700DaySeriesIsAggregatedOnServerAndOversizedCsvIsRejected()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Path.Combine(folder, "test.db") }.ToString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandTimeout = 60;
        command.CommandText = """
            WITH RECURSIVE ticks(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM ticks WHERE n < 2015999)
            INSERT INTO Samples (Key,Time,Value,Quality,Retained)
            SELECT 'flowTemperature', $start+n*30, 20, 1, 0 FROM ticks;
            """;
        command.Parameters.AddWithValue("$start", Start.ToUnixTimeSeconds());
        await command.ExecuteNonQueryAsync();
        var result = await store.QueryAsync(new(["flowTemperature"], Start, Start.AddDays(700), 86400), default);
        Assert.Equal(700, result.Series[0].Points.Count);
        Assert.All(result.Series[0].Points, p => { Assert.Equal(20, p.Value); Assert.Equal(2880, p.Samples); });
        // Duplicate keys are separately rejected; use a long enough raw range to exceed 100,000 rows.
        var export = new HistoryQuery(["flowTemperature"], Start, Start.AddDays(30), 30);
        var csv = await store.ExportAsync(export, default);
        Assert.Equal(86402, csv.Split('\n').Length);
        command.CommandText = "INSERT INTO Samples (Key,Time,Value,Quality,Retained) SELECT 'returnTemperature', Time, Value, Quality, Retained FROM Samples WHERE Time < $start+2592000";
        await command.ExecuteNonQueryAsync();
        var error = await Assert.ThrowsAsync<HistoryRequestException>(() => store.ExportAsync(export with { Keys = ["flowTemperature", "returnTemperature"] }, default));
        Assert.Equal("export_too_large", error.Code);
    }
    [Fact]
    public async Task StateTransitionsDoNotBecomeFractionalStates()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        foreach (var i in new[] { 0, 1 })
        {
            var frame = Frame(Start.AddSeconds(i * 30));
            frame = frame with { Values = [frame.Values[0] with { Key = "heatpumpState", Value = i, Unit = "enum" }] };
            await store.CaptureAsync(frame, true, default);
        }
        var result = await store.QueryAsync(new(["heatpumpState"], Start, Start.AddSeconds(60), 60), default);
        Assert.Null(result.Series[0].Points[0].Value);
        Assert.Equal(Quality.Unknown, result.Series[0].Points[0].Quality);
    }
    [Fact]
    public async Task ExportAndHistoryRespectSubsecondHalfOpenBoundaries()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(Start, value: 10), true, default);
        await store.CaptureAsync(Frame(Start.AddSeconds(30), value: 20), true, default);
        var query = new HistoryQuery(["flowTemperature"], Start.AddMilliseconds(1), Start.AddSeconds(30).AddMilliseconds(1), 30);
        var history = await store.QueryAsync(query, default);
        Assert.Single(history.Series[0].Points, p => p.Samples > 0);
        Assert.Equal(20, history.Series[0].Points.Single(p => p.Samples > 0).Value);
        var csv = await store.ExportAsync(query, default);
        Assert.DoesNotContain(";10;", csv);
        Assert.Contains(";20;", csv);
    }
    [Fact]
    public async Task EventValuesAreCapturedWithUnitsQualityAndSurviveRestart()
    {
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            var frame = Frame(Start);
            var pressure = frame.Values[0] with { Key = "waterPressure", Unit = "bar", Value = 1.6d };
            var valve = pressure with { Key = "threeWayValveState", Unit = "enum", Value = 1 };
            await store.CaptureAsync(frame with { Values = [pressure, valve] }, false, default);
            await store.CaptureAsync(frame with { Values = [pressure with { Value = 1.65d, Quality = Quality.Stale }, valve] }, false, default);
            await store.CaptureAsync(frame with { Values = [pressure with { Value = null, Quality = Quality.Invalid }, valve] }, false, default);
        }
        using var restarted = Open();
        await restarted.InitializeAsync(default);
        var events = (await restarted.EventsAsync(null, null, default)).Items;
        Assert.Contains(events, e => e.Key == "waterPressure" && e.Message == "Datenqualität: Valid · Wert: 1,60 bar");
        Assert.Contains(events, e => e.Key == "waterPressure" && e.Message == "Datenqualität: Stale · Wert: 1,65 bar (veraltet)");
        Assert.Contains(events, e => e.Key == "waterPressure" && e.Message == "Datenqualität: Invalid · Wert: —");
        Assert.Contains(events, e => e.Kind == "state" && e.Message == "Beobachteter Zustand: Warmwasser (1)");
    }
    [Fact]
    public async Task FlowReadingsAndSpreadDiagnosticsPersistWithoutDuplicateEvents()
    {
        using (var store = Open())
        {
            await store.InitializeAsync(default);
            var telemetry = new TelemetryStore(SourceKind.Simulator);
            telemetry.SetConnection(true);
            telemetry.Receive("main/Main_Outlet_Temp", "35");
            telemetry.Receive("main/Main_Inlet_Temp", "30");
            telemetry.Receive("main/Pump_Flow", "15.89");
            telemetry.Receive("main/Pump_Flow", "15.89");
            telemetry.Receive("main/Main_Outlet_Temp", "");
            var snapshot = telemetry.Read();
            await store.CaptureAsync(snapshot, true, default);
            var events = (await store.EventsAsync(null, "quality", default)).Items;
            Assert.DoesNotContain(events, e => e.Key == "waterFlow" && e.Message.Contains("Fehlmessung"));
            Assert.Contains(events, e => e.Key == "temperatureSpread" && e.Message.Contains("verworfen"));
            var count = events.Count;
            await store.CaptureAsync(telemetry.Read(), false, default);
            Assert.Equal(count, (await store.EventsAsync(null, "quality", default)).Items.Count);
            var now = snapshot.GeneratedAtUtc;
            var data = await store.QueryAsync(new(["waterFlow", "temperatureSpread"], now.AddMinutes(-1), now.AddMinutes(1), 30), default);
            Assert.Contains(data.Series.Single(s => s.Key == "waterFlow").Points, p => p.Value == 15.89);
            Assert.Contains(data.Series.Single(s => s.Key == "temperatureSpread").Points, p => p.Value == 5);
        }
        using var restarted = Open();
        await restarted.InitializeAsync(default);
        Assert.Contains((await restarted.EventsAsync(null, null, default)).Items, e => e.Key == "temperatureSpread" && e.Message.Contains("verworfen"));
    }
    [Fact]
    public async Task NoErrorEventUsesHealthyLabelAndPreservesStaleMarker()
    {
        using var store = Open();
        await store.InitializeAsync(default);
        var frame = Frame(Start);
        var error = frame.Values[0] with { Key = "activeError", Unit = "", Value = "H76" };
        await store.CaptureAsync(frame with { Values = [error] }, false, default);
        await store.CaptureAsync(frame with { Values = [error with { Value = "no error" }] }, false, default);
        await store.CaptureAsync(frame with { Values = [error with { Value = "no error", Quality = Quality.Stale }] }, false, default);
        var events = (await store.EventsAsync(null, null, default)).Items;
        Assert.Contains(events, e => e.Message == "Gemeldeter Fehler: H76");
        Assert.Contains(events, e => e.Message == "Fehlerstatus: Fehlerfrei");
        Assert.Contains(events, e => e.Message == "Datenqualität: Stale · Wert: Fehlerfrei (veraltet)");
        Assert.DoesNotContain(events, e => e.Message.Contains("Gemeldeter Fehler: no error"));
    }
    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(folder)) Directory.Delete(folder, true);
    }
}
