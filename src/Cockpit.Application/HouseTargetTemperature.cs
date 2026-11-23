using Cockpit.Domain;

namespace Cockpit.Application;

public sealed partial class TelemetryStore
{
    private HouseTemperatureOptions houseTargetTemperature = new();
    private long houseTargetTemperatureGeneration;
    private TelemetryValue? houseTargetTemperatureValue;

    public void ConfigureHouseTargetTemperature(HouseTemperatureOptions options, long generation)
    {
        options.Validate();
        lock (gate)
        {
            if (houseTargetTemperature == options && houseTargetTemperatureGeneration == generation) return;
            houseTargetTemperature = options;
            houseTargetTemperatureGeneration = generation;
            houseTargetTemperatureValue = null;
        }
    }
    public void ReceiveHouseTargetTemperature(string topic, string payload, bool retained, long generation)
    {
        lock (gate)
        {
            if (!connected || !houseTargetTemperature.Enabled || generation != houseTargetTemperatureGeneration || topic != houseTargetTemperature.Sensor.Topic) return;
            var reading = PowerPayload.Read(payload, houseTargetTemperature.Sensor.PayloadPath, allowNegative: true);
            if (!reading.Present) return;
            var temperature = reading.Watts is >= -50 and <= 100 ? reading.Watts : null;
            houseTargetTemperatureValue = new("mqttHouseTargetTemperature", temperature, Catalog.Celsius,
                temperature.HasValue ? retained ? Quality.Stale : Quality.Valid : Quality.Invalid,
                clock.GetUtcNow(), null, retained, topic, sourceKind);
        }
    }
    private void AppendHouseTargetTemperature(List<TelemetryValue> target, DateTimeOffset now)
    {
        if (!houseTargetTemperature.Enabled) return;
        var value = houseTargetTemperatureValue ?? new("mqttHouseTargetTemperature", null, Catalog.Celsius, Quality.Unknown, null, null, false, houseTargetTemperature.Sensor.Topic, sourceKind);
        if (value.Quality == Quality.Valid && (!connected || now - value.ReceivedAtUtc > TimeSpan.FromSeconds(CopPolicy.MaxAgeSeconds)))
            value = value with { Quality = Quality.Stale };
        target.Add(value);
    }
}
