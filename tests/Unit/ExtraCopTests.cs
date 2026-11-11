using Cockpit.Application;
using Cockpit.Domain;
using Xunit;

namespace Cockpit.Unit;

public sealed class ExtraCopTests
{
    private readonly TestClock clock = new();
    private TelemetryStore Open(bool dhw = false)
    {
        var store = new TelemetryStore(SourceKind.Simulator, clock: clock);
        store.SetConnection(true); store.Receive("LWT", "Online");
        foreach (var (key, value) in new Dictionary<string, string> {
            ["operatingMode"] = dhw ? "3" : "0", ["threeWayValveState"] = dhw ? "1" : "0",
            ["heatpumpState"] = "1", ["compressorFrequency"] = "40", ["defrostState"] = "0", ["internalHeaterState"] = "0",
            ["heatPowerConsumption"] = dhw ? "0" : "1000", ["dhwPowerConsumption"] = dhw ? "1000" : "0",
            ["coolPowerConsumption"] = "0", ["heatPowerProduction"] = "4000", ["dhwPowerProduction"] = "3000" })
            store.Receive(Catalog.Metrics.Single(m => m.Key == key).Suffix, value);
        return store;
    }
    private static TelemetryValue Cop(TelemetryStore store) => store.Read().Values.Single(v => v.Key == "heishamonCop");
    [Fact]
    public void AlternativeMetersDoNotChangeTheOverviewCop()
    {
        var store = Open();
        var before = Cop(store);
        store.ConfigureAlternativePower(new(true, new("external/hp", ""), new("external/heater", "")), 1);
        store.ReceiveAlternativePower("external/hp", "750", false, 1);
        store.ReceiveAlternativePower("external/heater", "250", false, 1);
        Assert.Equal(before, Cop(store));
        Assert.Equal(4d, Cop(store).Value);
        store.ReceiveAlternativePower("external/hp", "broken", false, 1);
        Assert.Equal(before, Cop(store));
    }
    [Theory]
    [InlineData(false, 4)]
    [InlineData(true, 3)]
    public void OverviewUsesMatchingExtraMode(bool dhw, double expected)
    {
        var store = Open(dhw); Assert.Equal(expected, Cop(store).Value); Assert.Equal(Quality.Valid, Cop(store).Quality);
        clock.Advance(120); Assert.Equal(expected, Cop(store).Value);
        clock.Advance(1); Assert.Null(Cop(store).Value);
    }
    [Theory]
    [InlineData(60, true)]
    [InlineData(61, false)]
    public void PairBoundaryIsInclusive(int seconds, bool valid)
    {
        var store = Open(); clock.Advance(seconds); store.Receive("extra/Heat_Power_Production_Extra", "5000");
        Assert.Equal(valid ? 5d : null, Cop(store).Value);
    }
    [Theory]
    [InlineData(111, true)]
    [InlineData(120, true)]
    [InlineData(121, false)]
    public void FreshPowerPairAllowsOlderStatesAndInactiveChannels(int seconds, bool valid)
    {
        var store = Open(); clock.Advance(seconds);
        store.Receive("extra/Heat_Power_Consumption_Extra", "1000");
        store.Receive("extra/Heat_Power_Production_Extra", "4000");
        Assert.Equal(valid ? 4d : null, Cop(store).Value);
        Assert.Equal(valid ? Quality.Valid : Quality.Unknown, Cop(store).Quality);
    }
    [Theory]
    [InlineData("extra/Heat_Power_Consumption_Extra", "0", false)]
    [InlineData("extra/Heat_Power_Consumption_Extra", "199", false)]
    [InlineData("extra/Heat_Power_Production_Extra", "NaN", false)]
    [InlineData("extra/Heat_Power_Production_Extra", "4000", true)]
    [InlineData("main/Defrosting_State", "1", false)]
    [InlineData("main/Internal_Heater_State", "1", false)]
    [InlineData("main/Operating_Mode_State", "1", false)]
    public void UnsafeOrUnknownInputsRemainUnknown(string topic, string payload, bool retained)
    {
        var store = Open(); store.Receive(topic, payload, retained); Assert.Null(Cop(store).Value);
    }
}
