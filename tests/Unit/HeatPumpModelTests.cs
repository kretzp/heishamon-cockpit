using Cockpit.Application;
using Cockpit.Domain;
using Xunit;

namespace Cockpit.Unit;

public sealed class HeatPumpModelTests
{
    [Theory]
    [InlineData("E2 D5 0B 08 95 02 D6 0E 66 95", "Panasonic WH-SDC0309K3E5 / WH-UDZ05KE5")]
    [InlineData(" e2 d5 0b 08 95 02 d6 0e 66 95 ", "Panasonic WH-SDC0309K3E5 / WH-UDZ05KE5")]
    [InlineData("37", "Panasonic WH-SDC0309K3E5 / WH-UDZ05KE5")]
    [InlineData("E2 D5 0B 34 99 83 92 0C 27 98", "Panasonic WH-SDC0509L3E5 / WH-WDG05LE5")]
    [InlineData("E2 D5 0B 34 99 83 92 0D 27 98", "Panasonic WH-SDC0509L3E5 / WH-WDG05LE5")]
    [InlineData(" e2  d5 0b 34 99 83 92 0d 27 98 ", "Panasonic WH-SDC0509L3E5 / WH-WDG05LE5")]
    [InlineData("C2 D3 0B 35 65 B2 D3 0B 96 65", "Panasonic WH-MDC09J3E5")]
    [InlineData("FF FF FF FF FF FF FF FF FF FF", "FF FF FF FF FF FF FF FF FF FF")]
    [InlineData("999", "999")]
    public void ResolvesKnownModelsAndPreservesUnknownIdentifiers(string raw, string expected)
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive("main/Heat_Pump_Model", raw, retained: true);
        Assert.Equal(expected, store.Read().HeatPumpModel.DisplayName);
        Assert.Equal(raw.Trim(), store.Read().HeatPumpModel.RawIdentifier);
        Assert.Equal(Quality.Stale, store.Read().Values.Single(v => v.Key == "heatPumpModel").Quality);
    }

    [Fact]
    public void MissingModelNeverDefaultsToAnLSeriesAndResetClearsTheModel()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        Assert.Null(store.Read().HeatPumpModel.DisplayName);
        store.SetConnection(true);
        store.Receive("main/Heat_Pump_Model", "37");
        store.Reset();
        Assert.Null(store.Read().HeatPumpModel.RawIdentifier);
    }

    [Theory]
    [InlineData("-1")]
    [InlineData("91")]
    [InlineData("E2 D5 0B 34 99 83 92 0D 28 98")]
    public void LocalSignatureDoesNotAssignNumericIdsOrMatchOtherVariants(string raw)
    {
        var model = HeatPumpModels.Resolve(raw);
        Assert.False(model.Known);
        Assert.Equal(raw, model.DisplayName);
    }

    [Fact]
    public void ConfirmedLocalSignatureIsKnownWithoutChangingTheOriginalNumericId()
    {
        var model = HeatPumpModels.Resolve("E2 D5 0B 34 99 83 92 0D 27 98");
        Assert.True(model.Known);
        Assert.Equal(HeatPumpModels.Resolve("52").DisplayName, model.DisplayName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("bad\nidentifier")]
    public void RejectsEmptyOrControlCharacterPayloads(string raw)
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true);
        store.Receive("main/Heat_Pump_Model", raw);
        Assert.Null(store.Read().HeatPumpModel.DisplayName);
    }
}
