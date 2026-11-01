using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;

namespace Cockpit.Unit;

public sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-03-29T00:59:59Z");
    public override DateTimeOffset GetUtcNow() => Now;
    public void Advance(int seconds) => Now = Now.AddSeconds(seconds);
}

public sealed class TelemetryTests
{
    [Theory]
    [InlineData("operationsHours", "12345", 12345d, "h")]
    [InlineData("operationsCounter", "2345", 2345d, "")]
    [InlineData("waterPressure", "1.6", 1.6d, "bar")]
    public void PlantReadingsValidateUnitsAndFreshness(string key, string payload, double expected, string unit)
    {
        var metric = Catalog.Metrics.Single(m => m.Key == key);
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.SetConnection(true);
        Assert.Null(Get(store, key).Value);
        foreach (var invalid in new[] { "-1", "NaN", "Infinity", "bad" })
        {
            store.Receive(metric.Suffix, invalid);
            Assert.Null(Get(store, key).Value);
            Assert.Equal(Quality.Invalid, Get(store, key).Quality);
        }
        if (metric.Type == "counter")
            foreach (var invalid in new[] { "1.5", "9007199254740992" })
                Assert.Equal(Quality.Invalid, TelemetryStore.Parse(metric, invalid).Quality);
        Assert.Equal(0d, TelemetryStore.Parse(metric, "0").Value);
        store.Receive(metric.Suffix, payload, true);
        Assert.Equal(Quality.Stale, Get(store, key).Quality);
        store.Receive(metric.Suffix, payload);
        Assert.Equal(expected, Get(store, key).Value);
        Assert.Equal(unit, Get(store, key).Unit);
        Assert.Equal(Quality.Valid, Get(store, key).Quality);
        clock.Advance(121);
        Assert.Equal(Quality.Stale, Get(store, key).Quality);
    }

    [Theory]
    [InlineData("15.89", 15.89d)]
    [InlineData("15.890", 15.89d)]
    [InlineData("15.889", 15.889d)]
    [InlineData("15.891", 15.891d)]
    [InlineData("0", 0d)]
    public void PumpFlowPreservesValidReadings(string payload, double expected)
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive("main/Pump_Flow", payload);
        Assert.Equal(expected, Get(store, "waterFlow").Value);
        Assert.Equal(Quality.Valid, Get(store, "waterFlow").Quality);
        Assert.DoesNotContain(store.Read().Diagnostics, d => d.Key == "waterFlow");
        store.Receive("main/Main_Outlet_Temp", "15.89");
        Assert.Equal(15.89d, Get(store, "flowTemperature").Value);
    }

    [Fact]
    public void PumpFlowRetainsItsValueAndStaleQualityWhenRetained()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive("main/Pump_Flow", "15.89", true);
        Assert.Equal(15.89d, Get(store, "waterFlow").Value);
        Assert.Equal(Quality.Stale, Get(store, "waterFlow").Quality);
        Assert.True(Get(store, "waterFlow").Retained);
        store.Receive("main/Pump_Flow", "15.89");
        Assert.Equal(15.89d, Get(store, "waterFlow").Value);
        Assert.Equal(Quality.Valid, Get(store, "waterFlow").Quality);
        Assert.DoesNotContain(store.Read().Diagnostics, d => d.Key == "waterFlow");
    }

    [Theory]
    [InlineData("")]
    [InlineData("unknown")]
    [InlineData("NaN")]
    public void RejectedSpreadKeepsLastValueAndOriginalFreshness(string badPayload)
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, new(360, 10), clock);
        SimulatorSource.Apply(store, "normal");
        var original = Get(store, "temperatureSpread");
        clock.Advance(5);
        store.Receive("main/Main_Outlet_Temp", badPayload);
        var held = Get(store, "temperatureSpread");
        Assert.Equal(original, held);
        var diagnostic = store.Read().Diagnostics.Single(d => d.Key == "temperatureSpread");
        Assert.Contains("verworfen", diagnostic.Message);
        Assert.Equal(diagnostic, store.Read().Diagnostics.Single(d => d.Key == "temperatureSpread"));
        clock.Advance(355);
        Assert.Equal(Quality.Valid, Get(store, "temperatureSpread").Quality);
        clock.Advance(1);
        Assert.Equal(4.5d, Get(store, "temperatureSpread").Value);
        Assert.Equal(Quality.Stale, Get(store, "temperatureSpread").Quality);
        Assert.Equal(original.ReceivedAtUtc, Get(store, "temperatureSpread").ReceivedAtUtc);
        store.Receive("main/Main_Outlet_Temp", "36");
        store.Receive("main/Main_Inlet_Temp", "30");
        Assert.Equal(6d, Get(store, "temperatureSpread").Value);
        Assert.Equal(Quality.Valid, Get(store, "temperatureSpread").Quality);
        store.SetConnection(false);
        store.SetConnection(true);
        Assert.Equal(6d, Get(store, "temperatureSpread").Value);
        Assert.Equal(Quality.Stale, Get(store, "temperatureSpread").Quality);
    }

    [Theory]
    [InlineData("no error")]
    [InlineData("No Error")]
    [InlineData("NO ERROR")]
    [InlineData("nO eRrOr")]
    public void OnlyConfirmedNoErrorTokenIsHealthyAndStillAges(string payload)
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.SetConnection(true);
        store.Receive("main/Error", "H76");
        Assert.Equal("H76", Get(store, "activeError").Value);
        store.Receive("main/Error", payload, true);
        Assert.Equal("no error", Get(store, "activeError").Value);
        Assert.Equal(Quality.Stale, Get(store, "activeError").Quality);
        store.Receive("main/Error", payload);
        Assert.Equal(Quality.Valid, Get(store, "activeError").Quality);
        clock.Advance(121);
        Assert.Equal(Quality.Stale, Get(store, "activeError").Quality);
        store.Receive("main/Error", "?");
        Assert.Null(Get(store, "activeError").Value);
    }

    private static TelemetryValue Get(TelemetryStore s, string key) => s.Read().Values.Single(v => v.Key == key);

    [Theory]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("")]
    [InlineData("32,5")]
    [InlineData("1e999")]
    [InlineData("payload")]
    public void InvalidNumbersStayNull(string payload)
    {
        var result = TelemetryStore.Parse(Catalog.Metrics[0], payload);
        Assert.Null(result.Value);
        Assert.Equal(Quality.Invalid, result.Quality);
    }

    [Theory]
    [InlineData("0", "35", false)]
    [InlineData("1", "20", false)]
    [InlineData("2", "20", true)]
    [InlineData("-1", "20", false)]
    [InlineData("2", "NaN", false)]
    public void IndoorTargetOnlyUsesConfirmedRoomControl(string sensorMode, string request, bool expected)
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive("main/Z1_Heat_Request_Temp", request);
        Assert.Null(Get(store, "indoorTargetTemperature").Value);
        store.Receive("main/Z1_Sensor_Settings", sensorMode);
        var target = Get(store, "indoorTargetTemperature");
        Assert.Equal(expected ? 20d : null, target.Value);
        Assert.Equal(expected ? Quality.Valid : Quality.Unknown, target.Quality);
        Assert.Equal("°C", target.Unit);
    }
    [Fact]
    public void IndoorTargetRejectsRetainedStaleAndIncompatibleModeEvidence()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.SetConnection(true);
        store.Receive("main/Z1_Sensor_Settings", "2", true);
        store.Receive("main/Z1_Heat_Request_Temp", "20");
        Assert.Null(Get(store, "indoorTargetTemperature").Value);
        store.Receive("main/Z1_Sensor_Settings", "2");
        Assert.Equal(20d, Get(store, "indoorTargetTemperature").Value);
        clock.Advance(11);
        store.Receive("main/Z1_Heat_Request_Temp", "21");
        Assert.Null(Get(store, "indoorTargetTemperature").Value);
        store.Receive("main/Z1_Sensor_Settings", "2");
        Assert.Equal(21d, Get(store, "indoorTargetTemperature").Value);
        clock.Advance(121);
        Assert.Null(Get(store, "indoorTargetTemperature").Value);
    }

    [Fact]
    public void ExtraPowerRequiresValidReceivedDataAndRejectsNegativeLegacyValues()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        Assert.Null(Get(store, "heatPowerConsumption").Value);
        store.Receive("main/Heat_Power_Consumption", "850");
        Assert.Null(Get(store, "heatPowerConsumption").Value);
        store.Receive("extra/Heat_Power_Consumption_Extra", "-200");
        Assert.Equal(Quality.Invalid, Get(store, "heatPowerConsumption").Quality);
        store.Receive("extra/Heat_Power_Consumption_Extra", "850");
        Assert.Equal(850d, Get(store, "heatPowerConsumption").Value);
        Assert.Equal("W", Get(store, "heatPowerConsumption").Unit);
    }
    [Fact]
    public void ConfirmedPublishAllRemainsFreshFor360SecondsWithoutChangingReception()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, new(360, 10), clock);
        store.SetConnection(true);
        store.Receive("main/Main_Outlet_Temp", "35");
        var original = Get(store, "flowTemperature").ReceivedAtUtc;
        clock.Advance(300);
        Assert.Equal(Quality.Valid, Get(store, "flowTemperature").Quality);
        clock.Advance(61);
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
        Assert.Equal(original, Get(store, "flowTemperature").ReceivedAtUtc);
    }

    [Fact]
    public void MissingValuesAreNotZero()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        Assert.All(store.Read().Values, v => { Assert.Null(v.Value); Assert.Equal(Quality.Unknown, v.Quality); });
    }

    [Fact]
    public void TemperaturesAllowNegativeButFlowDoesNot()
    {
        Assert.Equal(-12.5, TelemetryStore.Parse(Catalog.Metrics[2], "-12.5").Value);
        Assert.Equal(Quality.Invalid, TelemetryStore.Parse(Catalog.Metrics[5], "-1").Quality);
    }

    [Theory]
    [InlineData("-1", Quality.Invalid)]
    [InlineData("99", Quality.Unknown)]
    [InlineData("1.5", Quality.Invalid)]
    [InlineData("4", Quality.Valid)]
    public void EnumValidation(string payload, Quality expected)
        => Assert.Equal(expected, TelemetryStore.Parse(Catalog.Metrics[8], payload).Quality);

    [Theory]
    [InlineData("0")]
    [InlineData("?")]
    public void UnconfirmedErrorStatusNeverMeansHealthy(string payload)
    {
        var parsed = TelemetryStore.Parse(Catalog.Metrics.Single(m => m.Key == "activeError"), payload);
        Assert.Null(parsed.Value);
        Assert.Equal(Quality.Unknown, parsed.Quality);
    }

    [Fact]
    public void NormalDataUnitsSpreadAndSourceAreCorrect()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        SimulatorSource.Apply(store, "normal");
        Assert.Equal(21.5, Get(store, "indoorTemperature").Value);
        Assert.Equal("°C", Get(store, "indoorTemperature").Unit);
        Assert.Equal("main/Room_Thermostat_Temp", Get(store, "indoorTemperature").SourceTopic);
        Assert.Equal(34.5, Get(store, "flowTemperature").Value);
        Assert.Equal("°C", Get(store, "flowTemperature").Unit);
        Assert.Equal(4.5, Get(store, "temperatureSpread").Value);
        Assert.Equal("K", Get(store, "temperatureSpread").Unit);
        Assert.Equal("l/min", Get(store, "waterFlow").Unit);
        Assert.Equal("Hz", Get(store, "compressorFrequency").Unit);
        Assert.All(store.Read().Values, v => Assert.Equal(SourceKind.Simulator, v.SourceKind));
    }

    [Fact]
    public void FreshnessExpiresWithoutAnotherMessageAndDoesNotRefreshTimestamp()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Simulator, clock: clock);
        SimulatorSource.Apply(store, "normal");
        var original = Get(store, "flowTemperature");
        clock.Advance(120);
        Assert.Equal(Quality.Valid, Get(store, "flowTemperature").Quality);
        clock.Advance(1);
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
        Assert.Equal(original.ReceivedAtUtc, Get(store, "flowTemperature").ReceivedAtUtc);
        Assert.Equal(4.5d, Get(store, "temperatureSpread").Value);
        Assert.Equal(Quality.Stale, Get(store, "temperatureSpread").Quality);
        Assert.Equal(TimeSpan.Zero, store.Read().GeneratedAtUtc.Offset);
    }

    [Fact]
    public void SpreadRequiresCompatibleReceptionTimes()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Simulator, clock: clock);
        SimulatorSource.Apply(store, "normal");
        clock.Advance(11);
        store.Receive("main/Main_Outlet_Temp", "35");
        Assert.Equal(4.5d, Get(store, "temperatureSpread").Value);
        store.Receive("main/Main_Inlet_Temp", "30");
        Assert.Equal(5d, Get(store, "temperatureSpread").Value);
    }

    [Fact]
    public void OverflowingSpreadStaysNullAndSnapshotCanBeSerialized()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        store.SetConnection(true);
        store.Receive("main/Main_Outlet_Temp", "1e308");
        store.Receive("main/Main_Inlet_Temp", "-1e308");
        var snapshot = store.Read();
        var spread = snapshot.Values.Single(v => v.Key == "temperatureSpread");
        Assert.Null(spread.Value);
        Assert.Equal(Quality.Invalid, spread.Quality);
        Assert.Equal(Quality.Invalid, snapshot.TelemetryFreshness);
        Assert.NotEmpty(System.Text.Json.JsonSerializer.Serialize(snapshot));
    }

    [Fact]
    public void RetainedAndLwtOnlineDoNotProveFreshness()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        SimulatorSource.Apply(store, "retained");
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
        Assert.True(Get(store, "flowTemperature").Retained);
        store.Receive("LWT", "Online", true);
        Assert.Equal(Availability.Unknown, store.Read().DeviceAvailability);
        store.Receive("LWT", "Online");
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
    }

    [Fact]
    public void OfflineAndReconnectNeedNewLiveData()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        SimulatorSource.Apply(store, "normal");
        store.Receive("LWT", "Offline");
        Assert.True(store.Read().BrokerConnected);
        Assert.Equal(Availability.Offline, store.Read().DeviceAvailability);
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
        store.SetConnection(false);
        store.SetConnection(true);
        store.Receive("LWT", "Online");
        Assert.Equal(Quality.Stale, Get(store, "flowTemperature").Quality);
        store.Receive("main/Main_Outlet_Temp", "35");
        Assert.Equal(Quality.Valid, Get(store, "flowTemperature").Quality);
        Assert.Equal(4.5d, Get(store, "temperatureSpread").Value);
    }

    [Fact]
    public void UnknownTopicsAreIgnoredAndInvalidPayloadReplacesLastValue()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        SimulatorSource.Apply(store, "normal");
        var countBefore = store.Read().Values.Count;
        store.Receive("commands/SetDHWTemp", "60");
        Assert.Equal(countBefore, store.Read().Values.Count);
        store.Receive("main/Main_Outlet_Temp", "invalid");
        Assert.Null(Get(store, "flowTemperature").Value);
    }

    [Fact]
    public void RevisionIsMonotonicAndInstanceChangesOnRestart()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        var first = store.Read();
        Assert.True(store.Read().Revision > first.Revision);
        Assert.NotEqual(first.InstanceId, new TelemetryStore(SourceKind.Simulator).InstanceId);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(120, 121)]
    [InlineData(4000, 10)]
    public void InvalidConfigurationIsRejected(int fresh, int pair)
        => Assert.Throws<ArgumentException>(() => new TelemetryStore(SourceKind.Simulator, new(fresh, pair)));
}
