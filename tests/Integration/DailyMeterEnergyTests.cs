using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Cockpit.Integration;

public sealed class DailyMeterEnergyTests : IDisposable
{
    private readonly string folder = Path.Combine(Path.GetTempPath(), "cockpit-meter-energy-" + Guid.NewGuid().ToString("N"));
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-11-01T10:00:00Z");
    private string PathName => Path.Combine(folder, "test.db");
    private SqliteHistoryStore Open() => new(PathName, SourceKind.Mqtt, new());

    private async Task Samples(DateTimeOffset start, int count, Action<int, Dictionary<string, double>>? change = null)
    {
        await using var db = new SqliteConnection($"Data Source={PathName}");
        await db.OpenAsync();
        using var tx = db.BeginTransaction();
        using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        for (var i = 0; i < count; i++)
        {
            var values = new Dictionary<string, double> {
                ["heatPowerConsumption"] = 5000, ["coolPowerConsumption"] = 0, ["dhwPowerConsumption"] = 0,
                ["alternativeHeatpumpPower"] = 800, ["alternativeHeaterPower"] = 50,
                ["alternativePowerEnabled"] = 1, ["alternativePowerGeneration"] = 1 };
            change?.Invoke(i, values);
            foreach (var (key, value) in values)
            {
                cmd.Parameters.Clear();
                cmd.CommandText = "INSERT INTO Samples VALUES ($key,$time,$value,NULL,1,$received,0)";
                cmd.Parameters.AddWithValue("$key", key); cmd.Parameters.AddWithValue("$value", value);
                cmd.Parameters.AddWithValue("$time", start.AddSeconds(i * 30).ToUnixTimeSeconds());
                cmd.Parameters.AddWithValue("$received", start.AddSeconds(i * 30).ToUnixTimeMilliseconds());
                await cmd.ExecuteNonQueryAsync();
            }
        }
        tx.Commit();
    }

    private async Task Raw(DateTimeOffset start, int[] offsets, Action<SqliteCommand>? change = null)
    {
        await using var db = new SqliteConnection($"Data Source={PathName}"); await db.OpenAsync();
        using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS ShellySamples (Id TEXT PRIMARY KEY,Time INTEGER,Generation TEXT,
                DeviceId TEXT,DeviceTime INTEGER,Heatpump REAL,Heater REAL,HeatpumpReceived INTEGER,
                HeaterReceived INTEGER,Thermal REAL,ThermalReceived INTEGER,Mode TEXT,OperatingMode INTEGER);
            CREATE INDEX IF NOT EXISTS IX_ShellySamples_Time ON ShellySamples(Time);
            """;
        await cmd.ExecuteNonQueryAsync();
        foreach (var offset in offsets)
        {
            cmd.Parameters.Clear();
            cmd.CommandText = "INSERT INTO ShellySamples VALUES ($id,$time,$generation,$device,$time,$a,$c,$received,$received,NULL,NULL,NULL,NULL)";
            cmd.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("$time", start.AddSeconds(offset).ToUnixTimeMilliseconds());
            cmd.Parameters.AddWithValue("$received", start.AddSeconds(offset).ToUnixTimeMilliseconds());
            cmd.Parameters.AddWithValue("$a", 50); cmd.Parameters.AddWithValue("$c", 800);
            cmd.Parameters.AddWithValue("$generation", "g"); cmd.Parameters.AddWithValue("$device", "d");
            change?.Invoke(cmd);
            await cmd.ExecuteNonQueryAsync();
        }
        tx.Commit();
    }

    [Fact]
    public async Task LegacyRawEnergyMatchesOldChannelSumWithoutCountingConvertedSamples()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Raw(Start, [0, 10, 20]);
        await Samples(Start, 3, (i, v) => { if (i > 0) { v.Remove("alternativeHeatpumpPower"); v.Remove("alternativeHeaterPower"); } });
        var result = await store.EnergyAsync(2026, 10, Start.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == "2026-11-01");
        Assert.Equal("shelly-ac", result.ElectricalSource);
        Assert.Equal(850d * 20 / 3600000, day.Kwh!.Value, 12);
        Assert.Equal(800d * 20 / 3600000, day.HeatpumpKwh!.Value, 12);
        Assert.Equal(50d * 20 / 3600000, day.HeaterKwh!.Value, 12);
        Assert.Equal(20, day.ValidSeconds);
    }

    [Theory]
    [InlineData("gap")]
    [InlineData("generation")]
    [InlineData("device")]
    [InlineData("stale")]
    [InlineData("missing")]
    public async Task LegacyInvalidIntervalsRemainGapsWithoutExtraFallback(string reason)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Raw(Start, reason == "gap" ? [0, 30] : [0, 10], cmd => {
            if (reason == "generation") cmd.Parameters["$generation"].Value = cmd.Parameters["$id"].Value;
            if (reason == "device") cmd.Parameters["$device"].Value = cmd.Parameters["$id"].Value;
            if (reason == "stale") cmd.Parameters["$received"].Value = Start.AddMinutes(-1).ToUnixTimeMilliseconds();
            if (reason == "missing") cmd.Parameters["$a"].Value = DBNull.Value;
        });
        await Samples(Start, 2, (_, v) => { v.Remove("alternativeHeatpumpPower"); v.Remove("alternativeHeaterPower"); });
        var day = (await store.EnergyAsync(2026, 10, Start.AddDays(1), default)).Days.Single(d => d.Date == "2026-11-01");
        Assert.Null(day.Kwh); Assert.Equal(0, day.ValidSeconds);
        if (reason == "missing") Assert.NotNull(day.HeatpumpKwh);
    }

    [Fact]
    public async Task AlternativeEnergyContinuesAfterArchiveWithoutOverlap()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Raw(Start, [0, 10, 20]);
        await Samples(Start, 4, (i, v) => v["alternativePowerGeneration"] = i == 0 ? 100 : 1);
        var result = await store.EnergyAsync(2026, 10, Start.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == "2026-11-01");
        Assert.Equal("mixed", result.ElectricalSource);
        Assert.Equal(80, day.ValidSeconds);
        Assert.Equal(850d * 80 / 3600000, day.Kwh!.Value, 12);
    }

    [Fact]
    public async Task AlternativeEnergyUsesBothChannelsEvenWithMissingExtraAndIndependentStates()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Samples(Start, 3, (_, v) => { v.Remove("heatPowerConsumption"); v.Remove("coolPowerConsumption"); v.Remove("dhwPowerConsumption"); });
        var result = await store.EnergyAsync(2026, 10, Start.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == "2026-11-01");
        Assert.Equal("alternative-mqtt", result.ElectricalSource);
        Assert.Equal(850d * 60 / 3600000, day.Kwh!.Value, 12);
        Assert.Equal(60, day.ValidSeconds);
    }

    [Theory]
    [InlineData("markers")]
    [InlineData("generation")]
    [InlineData("retained")]
    [InlineData("stale")]
    [InlineData("pair")]
    public async Task InvalidAlternativeIntervalsNeverFallBackToExtra(string reason)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Samples(Start, 4, (i, v) => {
            if (reason == "markers" && i > 0) { v.Remove("alternativePowerEnabled"); v.Remove("alternativePowerGeneration"); }
            if (reason == "generation") v["alternativePowerGeneration"] = i;
        });
        await using (var db = new SqliteConnection($"Data Source={PathName}"))
        {
            await db.OpenAsync(); using var cmd = db.CreateCommand();
            cmd.CommandText = reason switch {
                "retained" => "UPDATE Samples SET Retained=1 WHERE Key='alternativeHeatpumpPower'",
                "stale" => "UPDATE Samples SET Received=Time*1000-121000 WHERE Key='alternativeHeatpumpPower'",
                "pair" => "UPDATE Samples SET Received=Time*1000-11000 WHERE Key='alternativeHeatpumpPower'",
                _ => "SELECT 1" };
            await cmd.ExecuteNonQueryAsync();
        }
        var day = (await store.EnergyAsync(2026, 10, Start.AddDays(1), default)).Days.Single(d => d.Date == "2026-11-01");
        Assert.Null(day.Kwh); Assert.Equal(0, day.ValidSeconds);
    }

    [Fact]
    public async Task AlternativeZeroIsMeasuredAndExplicitDisableResumesExtraAfterBoundary()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Samples(Start, 4, (i, v) => {
            v["alternativeHeatpumpPower"] = 0; v["alternativeHeaterPower"] = 0;
            if (i >= 2) { v["alternativePowerEnabled"] = 0; v["alternativePowerGeneration"] = 2; }
        });
        var result = await store.EnergyAsync(2026, 10, Start.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == "2026-11-01");
        Assert.Equal("mixed", result.ElectricalSource);
        Assert.Equal(0, day.HeatpumpKwh); Assert.Equal(0, day.HeaterKwh);
        Assert.Equal(5000d * 30 / 3600000, day.Kwh!.Value, 12);
        Assert.Equal(60, day.ValidSeconds);
    }

    [Theory]
    [InlineData("2026-03-29", 23)]
    [InlineData("2026-10-25", 25)]
    public async Task LegacyEnergySplitsBerlinMidnightAndPreservesDstDayLength(string date, int hours)
    {
        using var store = Open(); await store.InitializeAsync(default);
        var midnight = EnergyCalendar.Midnight(DateOnly.Parse(date));
        await Raw(midnight, [-10, 0, 10]);
        var result = await store.EnergyAsync(2026, 10, midnight.AddDays(2), default);
        var day = result.Days.Single(d => d.Date == date);
        Assert.Equal(hours * 3600, day.ExpectedSeconds);
        Assert.Equal(10, day.ValidSeconds);
        Assert.Equal(850d * 10 / 3600000, day.Kwh!.Value, 12);
        Assert.Equal(10, result.Days.Single(d => d.Date == DateOnly.Parse(date).AddDays(-1).ToString("yyyy-MM-dd")).ValidSeconds);
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(folder)) Directory.Delete(folder, true);
    }
}
