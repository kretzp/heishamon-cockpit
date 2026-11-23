using Cockpit.Application;
using Cockpit.Domain;
using Xunit;
namespace Cockpit.Unit;

public sealed class HouseTargetTemperatureTests
{
    private readonly TestClock clock = new();
    private static HouseTemperatureOptions Options => new(true, new("house/sensor", "$.temperature"));
    [Theory]
    [InlineData("{\"temperature\":21.5}", 21.5)]
    [InlineData("{\"temperature\":-5}", -5)]
    [InlineData("{\"temperature\":0}", 0)]
    public void ReceivesSignedTemperatureWithoutReplacingIndoorTelemetry(string payload, double expected)
    {
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.ConfigureHouseTargetTemperature(Options, 1); store.SetConnection(true);
        store.ReceiveHouseTargetTemperature("house/sensor", payload, false, 1);
        var value = store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature");
        Assert.Equal(expected, value.Value); Assert.Equal(Quality.Valid, value.Quality);
        Assert.Null(store.Read().Values.Single(v => v.Key == "indoorTargetTemperature").Value);
    }
    [Theory]
    [InlineData("null")][InlineData("\"21\"")][InlineData("broken")][InlineData("1e999")][InlineData("101")][InlineData("-51")]
    public void RejectsInvalidOrImplausibleReadings(string payload)
    {
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.ConfigureHouseTargetTemperature(new(true, new("house", "")), 1); store.SetConnection(true);
        store.ReceiveHouseTargetTemperature("house", payload, false, 1);
        Assert.Equal(Quality.Invalid, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Quality);
    }
    [Fact] public void FreshnessReconnectGenerationAndDisableNeverReuseOldTemperature()
    {
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.ConfigureHouseTargetTemperature(Options, 1); store.SetConnection(true);
        store.ReceiveHouseTargetTemperature("house/sensor", "{\"temperature\":20}", true, 1);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Quality);
        store.ReceiveHouseTargetTemperature("house/sensor", "{\"temperature\":21}", false, 1);
        clock.Advance(121);
        store.ReceiveHouseTargetTemperature("house/sensor", "{\"humidity\":50}", false, 1);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Quality);
        store.SetConnection(false); store.SetConnection(true);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Quality);
        Assert.Equal(21d, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Value);
        store.ConfigureHouseTargetTemperature(Options with { Input = new("other", "") }, 2);
        store.ReceiveHouseTargetTemperature("house/sensor", "22", false, 1);
        Assert.Equal(Quality.Unknown, store.Read().Values.Single(v => v.Key == "mqttHouseTargetTemperature").Quality);
        store.ConfigureHouseTargetTemperature(new(), 3);
        Assert.DoesNotContain(store.Read().Values, v => v.Key == "mqttHouseTargetTemperature");
    }
}
