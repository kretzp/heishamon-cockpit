using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Cockpit.Integration;

public sealed class EfficiencyTests : IDisposable
{
    private readonly string folder = Path.Combine(Path.GetTempPath(), "cockpit-efficiency-" + Guid.NewGuid().ToString("N"));
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-01-10T10:00:00Z");
    private SqliteHistoryStore Open(SourceKind source = SourceKind.Simulator, int step = 30) => new(Path.Combine(folder, "test.db"), source, new(step));
    private async Task Seed(DateTimeOffset start, int count, int step = 30, Action<int, Dictionary<string, double>>? change = null, int skew = 0, int quality = 1, bool retained = false, int stateAge = 0)
    {
        await using var db = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}"); await db.OpenAsync();
        using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "INSERT INTO Samples(Key,Time,Value,Quality,Received,Retained) VALUES($key,$time,$value,$quality,$received,$retained)";
        foreach (var name in new[] { "$key", "$time", "$value", "$quality", "$received", "$retained" }) cmd.Parameters.AddWithValue(name, 0);
        for (var i = 0; i < count; i++)
        {
            var values = new Dictionary<string, double> { ["heatPowerConsumption"] = 1000, ["coolPowerConsumption"] = 0, ["dhwPowerConsumption"] = 0,
                ["heatPowerProduction"] = 4000, ["dhwPowerProduction"] = 0, ["heatpumpState"] = 1, ["compressorFrequency"] = 40,
                ["defrostState"] = 0, ["internalHeaterState"] = 0, ["operatingMode"] = 0, ["threeWayValveState"] = 0 };
            change?.Invoke(i, values);
            var time = start.AddSeconds(i * step);
            foreach (var (key, value) in values)
            {
                cmd.Parameters["$key"].Value = key; cmd.Parameters["$time"].Value = time.ToUnixTimeSeconds(); cmd.Parameters["$value"].Value = value;
                cmd.Parameters["$quality"].Value = quality; cmd.Parameters["$retained"].Value = retained;
                var age = key == "heatPowerProduction" ? skew : key == "heatPowerConsumption" ? 0 : stateAge;
                cmd.Parameters["$received"].Value = time.AddSeconds(-age).ToUnixTimeMilliseconds();
                await cmd.ExecuteNonQueryAsync();
            }
        }
        tx.Commit();
    }
    private static HistoryQuery Query(DateTimeOffset? start = null, int seconds = 900, int bucket = 30) => new(["heatPowerConsumption"], start ?? Start, (start ?? Start).AddSeconds(seconds), bucket);
    private static void Alternative(Dictionary<string, double> values, double heater = 0, double generation = 1)
    {
        values["alternativePowerEnabled"] = 1;
        values["alternativePowerGeneration"] = generation;
        values["alternativeHeatpumpPower"] = 750;
        values["alternativeHeaterPower"] = heater;
    }
    [Theory]
    [InlineData(false, 0, 4000d / 750)]
    [InlineData(false, 250, 4)]
    [InlineData(true, 0, 4)]
    public async Task AlternativeCopUsesBothMetersWithoutRequiringHeishamonElectricity(bool dhw, double heater, double expected)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 3, change: (_, v) => {
            Alternative(v, heater);
            v.Remove("heatPowerConsumption"); v.Remove("coolPowerConsumption"); v.Remove("dhwPowerConsumption");
            if (dhw) { v["operatingMode"] = 3; v["threeWayValveState"] = 1; v["dhwPowerProduction"] = 3000; }
        });
        var result = await store.CopAsync(Query(seconds: 60), 5, new(), default);
        Assert.Equal("alternative-mqtt", result.ElectricalSource);
        Assert.All(result.Points, point => Assert.Equal(expected, point.Cop));
        Assert.Equal(expected, result.EnergyRatio);
        var history = await store.QueryAsync(new(["alternativeHeatpumpPower", "alternativeHeaterPower"], Start, Start.AddMinutes(1), 30), default);
        Assert.Equal(2, history.Series.Count);
        Assert.All(history.Series, series => Assert.Equal("W", series.Unit));
    }
    [Theory]
    [InlineData("alternativeHeaterPower", false)]
    [InlineData("alternativeHeatpumpPower", false)]
    [InlineData("internalHeaterState", true)]
    [InlineData("defrostState", true)]
    public async Task InvalidAlternativeInputsNeverFallBackToHeishamon(string key, bool setState)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 3, change: (_, v) => { Alternative(v); if (setState) v[key] = 1; else v.Remove(key); });
        var result = await store.CopAsync(Query(seconds: 60), 5, new(), default);
        Assert.All(result.Points, point => Assert.Null(point.Cop));
        Assert.Null(result.EnergyRatio);
        Assert.Equal("alternative-mqtt", result.ElectricalSource);
    }
    [Fact]
    public async Task HistoricalSelectionAndConfigurationChangesBreakIntervalsAndSmoothing()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 8, change: (i, v) => { if (i >= 2) Alternative(v, 250, i >= 5 ? 2 : 1); });
        var result = await store.CopAsync(Query(seconds: 210), 5, new(), default);
        Assert.Equal("mixed", result.ElectricalSource);
        Assert.Equal(new double?[] { 4, null, 4, 4, null, 4, 4 }, result.Points.Select(p => p.Cop));
        Assert.All(result.Points, point => Assert.Null(point.Average));
        Assert.Equal("mixed", (await store.EnergyAsync(2026, 60, Start.AddDays(1), default)).ElectricalSource);
    }

    [Theory]
    [InlineData("2026-03-29")]
    [InlineData("2026-10-25")]
    public async Task DailyTemperatureUsesBerlinBoundariesAndValidSamples(string date)
    {
        using var store = Open(); await store.InitializeAsync(default);
        var start = EnergyCalendar.Midnight(DateOnly.Parse(date));
        var end = EnergyCalendar.Midnight(DateOnly.Parse(date).AddDays(1));
        await Seed(start.AddSeconds(-30), 1, change: (_, v) => v["outsideTemperature"] = -20);
        await Seed(start, 2, change: (i, v) => v["outsideTemperature"] = i == 0 ? 0 : -5);
        await Seed(start.AddMinutes(1), 1, quality: 2, change: (_, v) => v["outsideTemperature"] = -30);
        await Seed(start.AddMinutes(2), 1, retained: true, change: (_, v) => v["outsideTemperature"] = -40);
        await Seed(end, 1, change: (_, v) => v["outsideTemperature"] = -10);
        var result = await store.EnergyAsync(2026, 10, end.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == date);
        Assert.Equal(-5, day.MinOutdoorTemperatureC);
        Assert.Equal(2, day.OutdoorTemperatureSamples);
        var next = result.Days.Single(d => d.From == end);
        Assert.Equal(-10, next.MinOutdoorTemperatureC);
        Assert.Null(result.Days[0].MinOutdoorTemperatureC);
        Assert.Equal(0, result.Days[0].OutdoorTemperatureSamples);
    }

    [Fact]
    public async Task CopWindowUsesHistoryBeforeVisibleRangeAndSurvivesZoom()
    {
        using var store = Open(); await store.InitializeAsync(default); await Seed(Start.AddMinutes(-15), 62);
        var wide = await store.CopAsync(Query(), 15, new(), default);
        var zoom = await store.CopAsync(Query(Start.AddMinutes(5), 300), 15, new(), default);
        Assert.All(wide.Points, p => { Assert.Equal(4, p.Cop); Assert.Equal(4, p.Average); });
        Assert.Equal(wide.Points.Where(p => p.Time >= zoom.From && p.Time < zoom.To), zoom.Points);
        Assert.Equal(900, wide.ValidSeconds); Assert.Equal(4, wide.EnergyRatio);
    }
    [Theory]
    [InlineData("heatPowerConsumption", 0)]
    [InlineData("heatPowerConsumption", 199)]
    [InlineData("defrostState", 1)]
    [InlineData("internalHeaterState", 1)]
    [InlineData("operatingMode", 1)]
    [InlineData("coolPowerConsumption", 1000)]
    public async Task InvalidDenominatorStatesAndOverlappingModesRemainUnknown(string key, double value)
    {
        using var store = Open(); await store.InitializeAsync(default); await Seed(Start, 2, change: (_, v) => v[key] = value);
        var result = await store.CopAsync(Query(seconds: 30), 5, new(), default);
        Assert.Null(Assert.Single(result.Points).Cop); Assert.Null(result.EnergyRatio);
    }
    [Theory]
    [InlineData(61, 1, false)]
    [InlineData(0, 2, false)]
    [InlineData(0, 1, true)]
    public async Task UnsynchronisedStaleOrRetainedPowerCannotProduceCop(int skew, int quality, bool retained)
    {
        using var store = Open(); await store.InitializeAsync(default); await Seed(Start, 2, skew: skew, quality: quality, retained: retained);
        Assert.Null(Assert.Single((await store.CopAsync(Query(seconds: 30), 5, new(), default)).Points).Cop);
    }
    [Fact]
    public async Task MqttCopIsComputedWithoutBoundaryConfirmation()
    {
        using var store = Open(SourceKind.Mqtt); await store.InitializeAsync(default); await Seed(Start, 2);
        var result = await store.CopAsync(Query(seconds: 30), 5, new(), default);
        Assert.Equal(4, Assert.Single(result.Points).Cop); Assert.Equal(4, result.EnergyRatio);
    }
    [Theory]
    [InlineData(700, true)]
    [InlineData(29999, true)]
    [InlineData(30000, false)]
    [InlineData(31000, false)]
    public async Task CopAcceptsReceiptsWithinRoundedSlotButRejectsLaterReceipts(int offsetMilliseconds, bool valid)
    {
        using var store = Open(SourceKind.Mqtt); await store.InitializeAsync(default); await Seed(Start, 2);
        await using var db = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}");
        await db.OpenAsync();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE Samples SET Received=Received+$offset WHERE Key='compressorFrequency'";
        command.Parameters.AddWithValue("$offset", offsetMilliseconds); await command.ExecuteNonQueryAsync();
        var result = await store.CopAsync(Query(seconds: 30), 5, new(), default);
        Assert.Equal(valid ? 4d : null, Assert.Single(result.Points).Cop);
    }
    [Theory]
    [InlineData(90, true)]
    [InlineData(121, false)]
    public async Task CopHistoryAllowsOlderStatesWithFreshPowerPair(int stateAge, bool valid)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 2, stateAge: stateAge);
        var result = await store.CopAsync(Query(seconds: 30), 5, new(), default);
        Assert.Equal(valid ? 4d : null, Assert.Single(result.Points).Cop);
        Assert.Equal(valid ? 30 : 0, result.ValidSeconds);
    }
    [Fact]
    public async Task GapAndModeChangeRestartWindowAndMixedBucketIsUnknown()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 42, change: (i, v) => {
            if (i == 20) v.Remove("heatPowerConsumption");
            if (i >= 30) { v["heatPowerConsumption"] = 0; v["dhwPowerConsumption"] = 1000; v["dhwPowerProduction"] = 3000; v["threeWayValveState"] = 1; v["operatingMode"] = 3; }
        });
        var result = await store.CopAsync(Query(seconds: 1200), 5, new(), default);
        Assert.Equal(4, result.Points[9].Average); Assert.Null(result.Points[20].Cop); Assert.Null(result.Points[21].Average);
        Assert.Equal("dhw", result.Points[30].Mode); Assert.Null(result.Points[30].Average); Assert.Equal(3, result.Points[39].Average);
        Assert.Null(Assert.Single((await store.CopAsync(Query(seconds: 1200, bucket: 1200), 5, new(), default)).Points).Cop);
    }
    [Fact]
    public async Task NonDivisibleSampleWindowIsTimeWeighted()
    {
        using var store = Open(step: 120); await store.InitializeAsync(default); await Seed(Start, 4, step: 120);
        var result = await store.CopAsync(Query(seconds: 360, bucket: 120), 5, new(), default);
        Assert.Null(result.Points[1].Average); Assert.Equal(4, result.Points[2].Average);
    }
    [Fact]
    public async Task PartialCopBucketsKeepSeparateHeatingAndHotWaterMeasurements()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 9, change: (i, v) => {
            if (i == 2) v.Remove("heatPowerConsumption");
            if (i >= 4) { v["heatPowerConsumption"] = 0; v["dhwPowerConsumption"] = 1000;
                v["dhwPowerProduction"] = 3000; v["threeWayValveState"] = 1; v["operatingMode"] = 3; }
        });
        var fine = await store.CopAsync(Query(seconds: 240), 5, new(), default);
        var coarse = await store.CopAsync(Query(seconds: 240, bucket: 240), 5, new(), default);
        var heat = Assert.Single(coarse.Series.Single(s => s.Mode == "heat").Points);
        var dhw = Assert.Single(coarse.Series.Single(s => s.Mode == "dhw").Points);
        Assert.Equal(4, heat.Cop); Assert.Equal(30, heat.ValidSeconds); Assert.Equal(240, heat.ExpectedSeconds);
        Assert.Equal(3, dhw.Cop); Assert.Equal(120, dhw.ValidSeconds);
        Assert.Null(heat.Average); Assert.Null(dhw.Average);
        Assert.Equal(fine.ValidSeconds, coarse.ValidSeconds); Assert.Equal(fine.EnergyRatio, coarse.EnergyRatio);
        Assert.Equal(coarse.ValidSeconds, heat.ValidSeconds + dhw.ValidSeconds);
        Assert.Null(Assert.Single(coarse.Points).Cop); // Compatibility row never mixes the modes.
    }
    [Fact]
    public async Task PartialCopUsesMeasuredTimeOnlyAndDoesNotEraseOtherBuckets()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 9, change: (i, v) => { if (i == 2) v.Remove("heatPowerConsumption"); });
        var coarse = await store.CopAsync(Query(seconds: 240, bucket: 120), 5, new(), default);
        var heat = coarse.Series.Single(s => s.Mode == "heat").Points;
        Assert.Equal(new double?[] { 4, 4 }, heat.Select(p => p.Cop));
        Assert.Equal(new double[] { 60, 120 }, heat.Select(p => p.ValidSeconds));
        Assert.All(coarse.Series.Single(s => s.Mode == "dhw").Points, p => Assert.Null(p.Cop));
        Assert.Equal(180, coarse.ValidSeconds);
    }
    [Theory]
    [InlineData("2026-03-29", 23)]
    [InlineData("2026-10-25", 25)]
    public async Task FullBerlinDaysIntegrateActualDuration(string date, int hours)
    {
        using var store = Open(step: 300); await store.InitializeAsync(default);
        var start = EnergyCalendar.Midnight(DateOnly.Parse(date));
        await Seed(start, hours * 12 + 1, step: 300);
        var result = await store.EnergyAsync(2026, 10, DateTimeOffset.Parse("2027-01-01T12:00:00Z"), default);
        var day = Assert.Single(result.Days, d => d.Date == date);
        Assert.Equal(hours * 3600, day.ExpectedSeconds); Assert.Equal(day.ExpectedSeconds, day.ValidSeconds);
        Assert.Equal(hours, day.Kwh!.Value, 8); Assert.Equal("complete", day.Status);
    }
    [Fact]
    public async Task EnergyDistinguishesZeroMissingPartialCurrentAndRejectsDoubleCounting()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 5, change: (i, v) => { v["heatPowerConsumption"] = 0; if (i == 2) { v["heatPowerConsumption"] = 1000; v["dhwPowerConsumption"] = 1000; } });
        var result = await store.EnergyAsync(2026, 10, Start.AddDays(1), default);
        var day = result.Days.Single(d => d.Date == "2026-01-10");
        Assert.Equal(0, day.Kwh); Assert.Equal(60, day.ValidSeconds); Assert.Equal("partial", day.Status);
        Assert.Equal("missing", result.Days[0].Status); Assert.Null(result.Days[0].Kwh);
        Assert.Equal("current", result.Days.Single(d => d.Date == "2026-01-11").Status);
        Assert.Equal("future", result.Days[^1].Status);
    }
    [Fact]
    public async Task EnergySplitsRasterAtLocalMidnightWithoutInventingCoverage()
    {
        using var store = Open(step: 128); await store.InitializeAsync(default);
        var midnight = EnergyCalendar.Midnight(new DateOnly(2026, 1, 11));
        await Seed(midnight.AddSeconds(-64), 2, step: 128);
        var result = await store.EnergyAsync(2026, 10, midnight.AddDays(1), default);
        foreach (var date in new[] { "2026-01-10", "2026-01-11" })
        {
            var day = result.Days.Single(d => d.Date == date);
            Assert.Equal(64, day.ValidSeconds); Assert.Equal(64d / 3600, day.Kwh!.Value, 8);
        }
    }
    [Fact]
    public async Task EnergyRatioIsNotArithmeticCopAverageAndThresholdIncludesBoundary()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Seed(Start, 3, change: (i, v) => { v["heatPowerConsumption"] = i == 0 ? 200 : 400; v["heatPowerProduction"] = 800; });
        var result = await store.CopAsync(Query(seconds: 60, bucket: 60), 5, new(), default);
        Assert.Equal(3, Assert.Single(result.Points).Cop);
        Assert.Equal(1600d / 600, result.EnergyRatio!.Value, 8);
    }
    [Fact]
    public async Task ValidationRejectsOversizedCopAndFutureCalendar()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.CopAsync(Query(seconds: 32 * 86400, bucket: 86400), 15, new(), default));
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.CopAsync(Query(), 7, new(), default));
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.EnergyAsync(2030, 10, Start, default));
    }
    public void Dispose() { SqliteConnection.ClearAllPools(); if (Directory.Exists(folder)) Directory.Delete(folder, true); }
}
