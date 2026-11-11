using Cockpit.Application;
using Cockpit.Domain;
using Xunit;

namespace Cockpit.Unit;

public sealed class AlternativePowerTests
{
    private readonly TestClock clock = new();
    private static AlternativePowerOptions Options => new(true,
        new("waermepumpe/events/rpc", "$.params[\"em:0\"].c_act_power"),
        new("waermepumpe/events/rpc", "$.params[\"em:0\"].a_act_power"));
    [Fact]
    public void RetainedReadingsAndInvalidationAreExplicitAndIndependentOfDeviceLwt()
    {
        var store = new TelemetryStore(SourceKind.Simulator, clock: clock);
        store.ConfigureAlternativePower(new(true, new("hp", ""), new("heater", "")), 1);
        store.SetConnection(true);
        store.ReceiveAlternativePower("hp", "900", true, 1);
        store.ReceiveAlternativePower("heater", "0", false, 1);
        store.Receive("LWT", "Offline");
        Assert.True(store.Read().Values.Single(v => v.Key == "alternativeHeatpumpPower").Retained);
        Assert.Equal(Quality.Valid, store.Read().Values.Single(v => v.Key == "alternativeHeaterPower").Quality);
        store.ReceiveAlternativePower("hp", "null", false, 1);
        Assert.Equal(Quality.Invalid, store.Read().Values.Single(v => v.Key == "alternativeHeatpumpPower").Quality);
        store.SetConnection(false);
        Assert.All(store.Read().Values.Where(v => v.Key is "alternativeHeatpumpPower" or "alternativeHeaterPower"), v => Assert.Equal(Quality.Unknown, v.Quality));
    }
    [Theory]
    [InlineData("$.params[\"em:0\"].c_act_power", "{\"params\":{\"em:0\":{\"c_act_power\":850}}}", 850)]
    [InlineData("$.meters[0].power", "{\"meters\":[{\"power\":0}]}", 0)]
    [InlineData("", "1200.5", 1200.5)]
    public void ReadsNumericWatts(string path, string payload, double expected)
        => Assert.Equal((true, (double?)expected), PowerPayload.Read(payload, path));
    [Theory]
    [InlineData("power")][InlineData("$..power")][InlineData("$.x[*]")][InlineData("$[?(@.x)]")]
    public void RejectsUnsupportedPaths(string path) => Assert.Throws<CommandRejected>(() => new PowerInput("meter", path).Validate(true));
    [Theory]
    [InlineData("-1")][InlineData("null")][InlineData("\"100\"")][InlineData("1e9999")][InlineData("broken")]
    public void RejectsInvalidPower(string payload) => Assert.Equal((true, (double?)null), PowerPayload.Read(payload, ""));
    [Fact]
    public void PartialUpdatesHaveIndependentFreshnessAndDoNotChangeOverviewCop()
    {
        var store = new TelemetryStore(SourceKind.Simulator, clock: clock);
        store.ConfigureAlternativePower(Options, 1);
        store.SetConnection(true);
        store.ReceiveAlternativePower("waermepumpe/events/rpc", "{\"params\":{\"em:0\":{\"c_act_power\":850,\"a_act_power\":0}}}", false, 1);
        clock.Advance(121);
        store.ReceiveAlternativePower("waermepumpe/events/rpc", "{\"params\":{\"em:0\":{\"a_act_power\":10}}}", false, 1);
        var snapshot = store.Read();
        Assert.Equal(Quality.Stale, snapshot.Values.Single(v => v.Key == "alternativeHeatpumpPower").Quality);
        Assert.Equal(10d, snapshot.Values.Single(v => v.Key == "alternativeHeaterPower").Value);
        Assert.Null(snapshot.Values.Single(v => v.Key == "heishamonCop").Value);
        store.ConfigureAlternativePower(Options with { Heater = new("other", "") }, 2);
        store.ReceiveAlternativePower("waermepumpe/events/rpc", "1000", false, 1);
        Assert.All(store.Read().Values.Where(v => v.Key is "alternativeHeatpumpPower" or "alternativeHeaterPower"), v => Assert.Equal(Quality.Unknown, v.Quality));
    }
}
