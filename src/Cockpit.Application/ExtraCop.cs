using System.Globalization;
using Cockpit.Domain;

namespace Cockpit.Application;

// A comparison value based on HeishaMon's electrical measurement boundary.
public static class ExtraCop
{
    public static TelemetryValue Calculate(IReadOnlyList<TelemetryValue> values, DateTimeOffset now, SourceKind source)
    {
        TelemetryValue Unknown() => new("heishamonCop", null, "", Quality.Unknown, null, null, false, null, source);
        var inputs = new List<TelemetryValue>();
        var powers = new List<TelemetryValue>();
        double? Read(string key, bool pairPower = false)
        {
            var value = values.FirstOrDefault(v => v.Key == key);
            if (value?.Quality != Quality.Valid || value.Retained || !value.ReceivedAtUtc.HasValue || value.Value is null
                || now < value.ReceivedAtUtc || (now - value.ReceivedAtUtc.Value).TotalSeconds > CopPolicy.MaxAgeSeconds) return null;
            var number = Convert.ToDouble(value.Value, CultureInfo.InvariantCulture);
            if (!double.IsFinite(number) || number < 0) return null;
            inputs.Add(value);
            if (pairPower) powers.Add(value);
            return number;
        }
        var operating = Read("operatingMode"); var valve = Read("threeWayValveState");
        var heat = valve == 0 && operating is 0 or 2 or 4 or 6;
        var dhw = valve == 1 && operating is 3 or 4 or 5 or 6 or 8;
        if ((!heat && !dhw) || Read("heatpumpState") != 1 || !(Read("compressorFrequency") > 0)
            || Read("defrostState") != 0 || Read("internalHeaterState") != 0) return Unknown();
        var electric = Read(heat ? "heatPowerConsumption" : "dhwPowerConsumption", true);
        var thermal = Read(heat ? "heatPowerProduction" : "dhwPowerProduction", true);
        if (!(electric >= 200) || thermal is null || Read("coolPowerConsumption") != 0
            || Read(heat ? "dhwPowerConsumption" : "heatPowerConsumption") != 0) return Unknown();
        var oldest = inputs.Min(v => v.ReceivedAtUtc!.Value);
        if ((powers.Max(v => v.ReceivedAtUtc!.Value) - powers.Min(v => v.ReceivedAtUtc!.Value)).TotalSeconds > CopPolicy.PairSeconds) return Unknown();
        var cop = thermal.Value / electric.Value;
        return double.IsFinite(cop)
            ? new("heishamonCop", cop, "", Quality.Valid, oldest, null, false, null, source)
            : Unknown();
    }
}
