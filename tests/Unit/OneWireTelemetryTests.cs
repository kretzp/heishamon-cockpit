using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;

namespace Cockpit.Unit;

public sealed class OneWireTelemetryTests
{
    [Fact]
    public void DallasSimulationProvidesAliasesChangingTemperaturesAndErrorStatuses()
    {
        var store = new TelemetryStore(SourceKind.Simulator);
        SimulatorSource.Apply(store, "normal");
        SimulatorSource.ApplyDallas(store, 0);
        var sensors = store.Read().Values.Where(v => v.Key.StartsWith("ds18b20_")).ToArray();
        Assert.Equal(5, sensors.Length);
        Assert.All(sensors, sensor => { Assert.False(string.IsNullOrEmpty(sensor.Alias)); Assert.Equal(SourceKind.Simulator, sensor.SourceKind); });
        Assert.Equal(3, sensors.Count(sensor => sensor.Quality == Quality.Valid));
        Assert.Single(sensors, sensor => sensor.Quality == Quality.Stale);
        Assert.Single(sensors, sensor => sensor.Quality == Quality.Invalid);
        var initial = sensors[0].Value;
        SimulatorSource.ApplyDallas(store, 30);
        Assert.NotEqual(initial, store.Read().Values.Single(v => v.Key == sensors[0].Key).Value);
    }
    private const string Topic = "1wire/28abcdef01234567";
    private const string Key = "ds18b20_28abcdef01234567";
    private static TelemetryValue Sensor(TelemetryStore store) => Assert.Single(store.Read().Values, v => v.Key == Key);

    [Fact]
    public void DallasRemainsFreshThrough330SecondsWithoutChangingOverviewPolicy()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, new TelemetryPolicy(FreshSeconds: 60), clock);
        store.SetConnection(true);
        store.Receive(Topic, "20");
        store.Receive("main/Outside_Temp", "6");
        clock.Advance(61);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "outsideTemperature").Quality);
        Assert.Equal(Quality.Valid, Sensor(store).Quality);
        clock.Advance(269);
        Assert.Equal(Quality.Valid, Sensor(store).Quality);
        clock.Advance(1);
        Assert.Equal(Quality.Stale, Sensor(store).Quality);
        Assert.Equal(20d, Sensor(store).Value);
        store.Receive(Topic, "21");
        Assert.Equal(Quality.Valid, Sensor(store).Quality);
    }

    [Fact]
    public void DiscoversTemperatureOnlyAndKeepsIdentityAcrossAliasChanges()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive(Topic + "/alias", "Puffer", true);
        store.Receive("1wire/not-an-address", "21");
        Assert.DoesNotContain(store.Read().Values, v => v.Key.StartsWith("ds18b20_"));
        store.Receive(Topic, "23.75", true);
        Assert.Equal(23.75d, Sensor(store).Value);
        Assert.Equal(Quality.Stale, Sensor(store).Quality);
        Assert.Equal("Puffer", Sensor(store).Alias);
        store.Receive(Topic.ToUpperInvariant().Replace("1WIRE", "1wire"), "-12.25");
        Assert.Equal(-12.25d, Sensor(store).Value);
        Assert.Equal(Quality.Valid, Sensor(store).Quality);
        Assert.Equal("°C", Sensor(store).Unit);
        store.Receive(Topic + "/alias", "Speicher");
        Assert.Equal("Speicher", Sensor(store).Alias);
        // Alias handling must not refresh the temperature timestamp or quality.
        store.SetConnection(false);
        Assert.Equal(Quality.Stale, Sensor(store).Quality);
        store.Reset();
        Assert.DoesNotContain(store.Read().Values, v => v.Key == Key);
    }

    [Fact]
    public void AliasesNeverRefreshTemperatureAndMalformedMetadataIsIgnored()
    {
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.SetConnection(true);
        store.Receive(Topic, "20.00");
        var received = Sensor(store).ReceivedAtUtc;
        clock.Advance(331);
        store.Receive(Topic + "/alias", "Innen");
        Assert.Equal(received, Sensor(store).ReceivedAtUtc);
        Assert.Equal(Quality.Stale, Sensor(store).Quality);
        store.Receive(Topic + "/alias", new string('x', 32));
        store.Receive(Topic + "/alias", "a\nb");
        Assert.Equal("Innen", Sensor(store).Alias);
        store.Receive(Topic + "/alias", "NOT SET");
        Assert.Null(Sensor(store).Alias);
        store.Receive(Topic + "/alias", "Tank");
        store.Receive(Topic + "/alias", "");
        Assert.Null(Sensor(store).Alias);
    }

    [Fact]
    public void DynamicDiscoveryIsBounded()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        for (var i = 0; i < 100; i++) store.Receive("1wire/" + i.ToString("x16"), "20");
        Assert.Equal(64, store.Read().Values.Count(v => v.Key.StartsWith("ds18b20_")));
    }

    [Theory]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("-127")]
    [InlineData("126")]
    [InlineData("23,75")]
    [InlineData("")]
    public void InvalidPayloadsDoNotDiscoverAndInvalidateKnownSensors(string payload)
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive(Topic, payload);
        Assert.DoesNotContain(store.Read().Values, v => v.Key == Key);
        store.Receive(Topic, "20");
        store.Receive(Topic, payload);
        Assert.Null(Sensor(store).Value);
        Assert.Equal(Quality.Invalid, Sensor(store).Quality);
    }

    [Fact]
    public void HistoryKeysAreStrictAndWorkBeforeDiscovery()
    {
        var start = DateTimeOffset.UnixEpoch;
        new HistoryQuery([Key], start, start.AddSeconds(30), 30).Validate(new());
        foreach (var invalid in new[] { Key + "/alias", "ds18b20_bad", "ds18b20_28ABCDEF01234567" })
            Assert.Throws<HistoryRequestException>(() => new HistoryQuery([invalid], start, start.AddSeconds(30), 30).Validate(new()));
    }
}
