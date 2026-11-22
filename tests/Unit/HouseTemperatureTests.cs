using Cockpit.Application;
using Cockpit.Domain;
using Xunit;
namespace Cockpit.Unit;

public sealed class HouseTemperatureTests
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
        store.ConfigureHouseTemperature(Options, 1); store.SetConnection(true);
        store.ReceiveHouseTemperature("house/sensor", payload, false, 1);
        var value = store.Read().Values.Single(v => v.Key == "mqttHouseTemperature");
        Assert.Equal(expected, value.Value); Assert.Equal(Quality.Valid, value.Quality);
        Assert.Null(store.Read().Values.Single(v => v.Key == "indoorTemperature").Value);
    }
    [Theory]
    [InlineData("null")][InlineData("\"21\"")][InlineData("broken")][InlineData("1e999")][InlineData("101")][InlineData("-51")]
    public void RejectsInvalidOrImplausibleReadings(string payload)
    {
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.ConfigureHouseTemperature(new(true, new("house", "")), 1); store.SetConnection(true);
        store.ReceiveHouseTemperature("house", payload, false, 1);
        Assert.Equal(Quality.Invalid, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Quality);
    }
    [Fact] public void FreshnessReconnectGenerationAndDisableNeverReuseOldTemperature()
    {
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        store.ConfigureHouseTemperature(Options, 1); store.SetConnection(true);
        store.ReceiveHouseTemperature("house/sensor", "{\"temperature\":20}", true, 1);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Quality);
        store.ReceiveHouseTemperature("house/sensor", "{\"temperature\":21}", false, 1);
        clock.Advance(121);
        store.ReceiveHouseTemperature("house/sensor", "{\"humidity\":50}", false, 1);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Quality);
        store.SetConnection(false); store.SetConnection(true);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Quality);
        Assert.Equal(21d, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Value);
        store.ConfigureHouseTemperature(Options with { Input = new("other", "") }, 2);
        store.ReceiveHouseTemperature("house/sensor", "22", false, 1);
        Assert.Equal(Quality.Unknown, store.Read().Values.Single(v => v.Key == "mqttHouseTemperature").Quality);
        store.ConfigureHouseTemperature(new(), 3);
        Assert.DoesNotContain(store.Read().Values, v => v.Key == "mqttHouseTemperature");
    }
}
