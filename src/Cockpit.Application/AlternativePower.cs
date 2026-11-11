using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record PowerInput(string Topic = "", string PayloadPath = "")
{
    public void Validate(bool required)
    {
        if (Topic is null || PayloadPath is null || Topic.Length > 200 || Topic.Any(char.IsControl)
            || Topic.IndexOfAny(['+', '#']) >= 0 || required && string.IsNullOrWhiteSpace(Topic))
            throw new CommandRejected(422, "invalid_power_topic");
        PowerPayload.ValidatePath(PayloadPath);
    }
}

public sealed record AlternativePowerOptions(bool Enabled = false, PowerInput? Heatpump = null, PowerInput? Heater = null)
{
    [JsonIgnore]
    public PowerInput HeatpumpInput => Heatpump ?? new();
    [JsonIgnore]
    public PowerInput HeaterInput => Heater ?? new();
    public void Validate() { HeatpumpInput.Validate(Enabled); HeaterInput.Validate(Enabled); }
    [JsonIgnore]
    public IEnumerable<string> Topics => Enabled ? new[] { HeatpumpInput.Topic, HeaterInput.Topic }.Distinct(StringComparer.Ordinal) : [];
}

// Deliberately limited JSON path: root, object properties and array indices only.
// No filters, scripts, recursive descent or wildcard evaluation.
public static partial class PowerPayload
{
    [GeneratedRegex("(?:\\.([A-Za-z_][A-Za-z0-9_]*))|(?:\\[\"([^\"\\\\]+)\"\\])|(?:\\[([0-9]{1,6})\\])", RegexOptions.CultureInvariant)]
    private static partial Regex Segment();
    public static void ValidatePath(string path)
    {
        if (path.Length > 256 || path.Any(char.IsControl)) throw new CommandRejected(422, "invalid_power_path");
        if (path.Length == 0) return;
        var end = 1;
        if (path[0] != '$') throw new CommandRejected(422, "invalid_power_path");
        foreach (Match match in Segment().Matches(path))
        {
            if (match.Index != end) throw new CommandRejected(422, "invalid_power_path");
            end += match.Length;
        }
        if (end != path.Length) throw new CommandRejected(422, "invalid_power_path");
    }
    // Missing property is a partial update; explicit null/wrong type is invalid.
    public static (bool Present, double? Watts) Read(string payload, string path)
    {
        try
        {
            if (payload.Length > 32768) return (true, null);
            using var document = JsonDocument.Parse(payload, new JsonDocumentOptions { MaxDepth = 16 });
            var value = document.RootElement;
            foreach (Match match in Segment().Matches(path))
            {
                if (match.Groups[3].Success)
                {
                    var index = int.Parse(match.Groups[3].Value, System.Globalization.CultureInfo.InvariantCulture);
                    if (value.ValueKind != JsonValueKind.Array) return (true, null);
                    if (index >= value.GetArrayLength()) return (false, null);
                    value = value[index];
                }
                else
                {
                    if (value.ValueKind != JsonValueKind.Object) return (true, null);
                    var key = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                    if (!value.TryGetProperty(key, out var child)) return (false, null);
                    value = child;
                }
            }
            return (true, value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var watts)
                && double.IsFinite(watts) && watts >= 0 ? watts : null);
        }
        catch (JsonException) { return (true, null); }
    }
}

public sealed partial class TelemetryStore
{
    private AlternativePowerOptions alternativePower = new();
    private long powerGeneration;
    private readonly Dictionary<string, TelemetryValue> powerValues = new();

    public void ConfigureAlternativePower(AlternativePowerOptions options, long generation)
    {
        options.Validate();
        lock (gate)
        {
            if (alternativePower == options && powerGeneration == generation) return;
            alternativePower = options;
            powerGeneration = generation;
            powerValues.Clear();
        }
    }
    public void ReceiveAlternativePower(string topic, string payload, bool retained, long generation)
    {
        lock (gate)
        {
            if (!connected || !alternativePower.Enabled || generation != powerGeneration) return;
            foreach (var (key, input) in new[] { ("alternativeHeatpumpPower", alternativePower.HeatpumpInput), ("alternativeHeaterPower", alternativePower.HeaterInput) })
            {
                if (topic != input.Topic) continue;
                var reading = PowerPayload.Read(payload, input.PayloadPath);
                if (!reading.Present) continue;
                powerValues[key] = new(key, reading.Watts, Catalog.Watt,
                    reading.Watts.HasValue ? retained ? Quality.Stale : Quality.Valid : Quality.Invalid, clock.GetUtcNow(), null, retained, topic, sourceKind);
            }
        }
    }
    private void AppendAlternativePower(List<TelemetryValue> target, DateTimeOffset now)
    {
        // Preserve the original snapshot for installations that never configured this feature.
        if (!alternativePower.Enabled && powerGeneration == 0) return;
        target.Add(new("alternativePowerEnabled", alternativePower.Enabled ? 1d : 0d, "", Quality.Valid, now, null, false, null, sourceKind));
        target.Add(new("alternativePowerGeneration", (double)powerGeneration, "", Quality.Valid, now, null, false, null, sourceKind));
        if (!alternativePower.Enabled) return;
        foreach (var key in new[] { "alternativeHeatpumpPower", "alternativeHeaterPower" })
        {
            var value = powerValues.GetValueOrDefault(key) ?? new(key, null, Catalog.Watt, Quality.Unknown, null, null, false, null, sourceKind);
            if (value.Quality == Quality.Valid && (!connected || now - value.ReceivedAtUtc > TimeSpan.FromSeconds(CopPolicy.MaxAgeSeconds)))
                value = value with { Quality = Quality.Stale };
            target.Add(value);
        }
    }
}
