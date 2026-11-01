using Cockpit.Application;
using Cockpit.Domain;
using Xunit;

namespace Cockpit.Unit;

public sealed class TechnicalTelemetryTests
{
    [Theory]
    [InlineData("pumpSpeed", "main/Pump_Speed", "U/min", 65, "1750.25", 1750.25)]
    [InlineData("fanSpeed", "main/Fan1_Motor_Speed", "U/min", 62, "650", 650)]
    [InlineData("compressorCurrent", "main/Compressor_Current", "A", 67, "4.44", 4.44)]
    [InlineData("highPressure", "main/High_Pressure", "kgf/cm²", 64, "10.24", 10.24)]
    public void MappingRawPrecisionZeroAndQuality(string key, string suffix, string unit, int top, string payload, double expected)
    {
        var metric = Catalog.Metrics.Single(m => m.Key == key);
        Assert.Equal(suffix, metric.Suffix); Assert.Equal(unit, metric.Unit); Assert.Equal(top, metric.Top);
        Assert.True(metric.Optional);
        var clock = new TestClock();
        var store = new TelemetryStore(SourceKind.Mqtt, clock: clock);
        TelemetryValue Value() => store.Read().Values.Single(v => v.Key == key);
        Assert.Null(Value().Value); Assert.Equal(Quality.Unknown, Value().Quality);
        store.SetConnection(true); store.Receive("LWT", "Online");
        store.Receive(suffix, payload, true);
        Assert.Equal(expected, Value().Value); Assert.Equal(Quality.Stale, Value().Quality);
        store.Receive(suffix, payload);
        Assert.Equal(expected, Value().Value); Assert.Equal(Quality.Valid, Value().Quality);
        clock.Advance(121); Assert.Equal(Quality.Stale, Value().Quality); Assert.Equal(expected, Value().Value);
        store.Receive(suffix, "0"); Assert.Equal(0d, Value().Value); Assert.Equal(Quality.Valid, Value().Quality);
        store.Receive("LWT", "Offline"); Assert.Equal(Quality.Stale, Value().Quality);
        store.Receive("LWT", "Online"); store.Receive(suffix, payload);
        store.SetConnection(false); store.SetConnection(true); Assert.Equal(Quality.Stale, Value().Quality);
        foreach (var invalid in new[] { "", "NaN", "Infinity", "-1", "4,4", "10 kgf/cm²", "unknown" })
        {
            store.Receive(suffix, invalid);
            Assert.Null(Value().Value); Assert.Equal(Quality.Invalid, Value().Quality);
        }
        Assert.True(HistoryQuery.Metrics.ContainsKey(key));
    }
}
