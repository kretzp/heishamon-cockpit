using System.Text.Json.Serialization;
using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record HouseTemperatureOptions(bool Enabled = false, PowerInput? Input = null)
{
    [JsonIgnore] public PowerInput Sensor => Input ?? new();
    [JsonIgnore] public IEnumerable<string> Topics => Enabled ? [Sensor.Topic] : [];
    public void Validate() => Sensor.Validate(Enabled);
    public bool HasSameSource(HouseTemperatureOptions other) => Enabled == other.Enabled && Sensor == other.Sensor;
}

public sealed partial class TelemetryStore
{
    private HouseTemperatureOptions houseTemperature = new();
    private long houseTemperatureGeneration;
    private TelemetryValue? houseTemperatureValue;

    public void ConfigureHouseTemperature(HouseTemperatureOptions options, long generation)
    {
        options.Validate();
        lock (gate)
        {
            if (houseTemperature == options && houseTemperatureGeneration == generation) return;
            houseTemperature = options;
            houseTemperatureGeneration = generation;
            houseTemperatureValue = null;
        }
    }
    public void ReceiveHouseTemperature(string topic, string payload, bool retained, long generation)
    {
        lock (gate)
        {
            if (!connected || !houseTemperature.Enabled || generation != houseTemperatureGeneration || topic != houseTemperature.Sensor.Topic) return;
            var reading = PowerPayload.Read(payload, houseTemperature.Sensor.PayloadPath, allowNegative: true);
            if (!reading.Present) return;
            var temperature = reading.Watts is >= -50 and <= 100 ? reading.Watts : null;
            houseTemperatureValue = new("mqttHouseTemperature", temperature, Catalog.Celsius,
                temperature.HasValue ? retained ? Quality.Stale : Quality.Valid : Quality.Invalid,
                clock.GetUtcNow(), null, retained, topic, sourceKind);
        }
    }
    private void AppendHouseTemperature(List<TelemetryValue> target, DateTimeOffset now)
    {
        if (!houseTemperature.Enabled) return;
        var value = houseTemperatureValue ?? new("mqttHouseTemperature", null, Catalog.Celsius, Quality.Unknown, null, null, false, houseTemperature.Sensor.Topic, sourceKind);
        if (value.Quality == Quality.Valid && (!connected || now - value.ReceivedAtUtc > TimeSpan.FromSeconds(CopPolicy.MaxAgeSeconds)))
            value = value with { Quality = Quality.Stale };
        target.Add(value);
    }
}
