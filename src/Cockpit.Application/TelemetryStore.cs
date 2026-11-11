using System.Globalization;
using System.Text.RegularExpressions;
using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record TelemetryPolicy(int FreshSeconds = 120, int MaxPairSeconds = 10)
{
    public void Validate()
    {
        if (FreshSeconds is < 1 or > 3600 || MaxPairSeconds < 0 || MaxPairSeconds > FreshSeconds)
            throw new ArgumentException("Invalid telemetry freshness policy.");
    }
}

public interface IReadOnlyTelemetrySource
{
    Task RunAsync(TelemetryStore store, CancellationToken cancellationToken);
}

public sealed partial class TelemetryStore
{
    private readonly object gate = new();
    private readonly Dictionary<string, TelemetryValue> values = new();
    private readonly Dictionary<string, string?> oneWireAliases = new();
    private readonly TimeProvider clock;
    private readonly TelemetryPolicy policy;
    private readonly SourceKind sourceKind;
    private bool connected;
    private Availability availability;
    private long revision;
    private TelemetryValue? lastSpread;
    private TelemetryValue? spreadFlowInput;
    private TelemetryValue? spreadReturnInput;
    private readonly Dictionary<string, TelemetryDiagnostic> diagnostics = new();
    public Guid InstanceId { get; } = Guid.NewGuid();
    public long ConnectionEpoch { get; private set; }
    public T Guarded<T>(Func<T> action) { lock (gate) return action(); }

    public TelemetryStore(SourceKind sourceKind, TelemetryPolicy? policy = null, TimeProvider? clock = null)
    {
        this.sourceKind = sourceKind;
        this.policy = policy ?? new();
        this.policy.Validate();
        this.clock = clock ?? TimeProvider.System;
        Reset();
    }

    public void Reset()
    {
        lock (gate)
        {
            ConnectionEpoch++;
            lastSpread = null;
            spreadFlowInput = null;
            spreadReturnInput = null;
            connected = false;
            availability = Availability.Unknown;
            values.Clear();
            powerValues.Clear();
            oneWireAliases.Clear();
            foreach (var m in Catalog.Metrics)
                values[m.Key] = new(m.Key, null, m.Unit, Quality.Unknown, null, null, false, null, sourceKind);
        }
    }

    public void SetConnection(bool isConnected)
    {
        lock (gate)
        {
            if (connected != isConnected)
            {
                ConnectionEpoch++;
                availability = Availability.Unknown;
                powerValues.Clear();
                InvalidateLiveValues();
            }
            connected = isConnected;
        }
    }

    private void InvalidateLiveValues()
    {
        if (lastSpread is not null) lastSpread = lastSpread with { Quality = Quality.Stale };
        foreach (var key in values.Keys)
            if (values[key].Quality == Quality.Valid) values[key] = values[key] with { Quality = Quality.Stale };
    }

    public void Receive(string suffix, string payload, bool retained = false, string? sourceTopic = null)
    {
        lock (gate)
        {
            if (!connected) return;
            if (suffix == "LWT")
            {
                if (payload != "Online" || retained) ConnectionEpoch++;
                availability = payload switch
                {
                    "Offline" => Availability.Offline,
                    "Online" when !retained => Availability.Online,
                    _ => Availability.Unknown
                };
                if (availability != Availability.Online) InvalidateLiveValues();
                return;
            }
            if (suffix.EndsWith("/alias", StringComparison.Ordinal) && OneWire.FromSuffix(suffix[..^6]) is { } aliasMetric)
            {
                if (payload.Length > 31 || payload.Any(char.IsControl)) return;
                if (!oneWireAliases.ContainsKey(aliasMetric.Key) && oneWireAliases.Count >= OneWire.MaximumSensors) return;
                var alias = string.IsNullOrWhiteSpace(payload) || payload == "NOT SET" ? null : payload;
                oneWireAliases[aliasMetric.Key] = alias;
                if (values.TryGetValue(aliasMetric.Key, out var existing)) values[aliasMetric.Key] = existing with { Alias = alias };
                return;
            }
            var metric = Catalog.Metrics.FirstOrDefault(m => m.Suffix == suffix) ?? OneWire.FromSuffix(suffix);
            if (metric is null) return;
            var (value, quality) = Parse(metric, payload);
            if (metric.Type == "ds18b20" && !values.ContainsKey(metric.Key)
                && (quality != Quality.Valid || values.Keys.Count(k => k.StartsWith(OneWire.KeyPrefix, StringComparison.Ordinal)) >= OneWire.MaximumSensors)) return;
            if (quality == Quality.Valid && (retained || availability == Availability.Offline)) quality = Quality.Stale;
            values[metric.Key] = new(metric.Key, value, metric.Unit, quality, clock.GetUtcNow(), null,
                retained, sourceTopic ?? suffix, sourceKind) { Alias = oneWireAliases.GetValueOrDefault(metric.Key) };
            if (metric.Key is "flowTemperature" or "returnTemperature") EvaluateSpread(clock.GetUtcNow());
        }
    }

    public static (object? Value, Quality Quality) Parse(Metric metric, string payload)
    {
        if (payload.Length is 0 or > 64) return (null, Quality.Invalid);
        if (metric.Type == "error")
        {
            // Operator-confirmed all-clear token; other tokens remain unknown.
            if (string.Equals(payload, Catalog.NoError, StringComparison.OrdinalIgnoreCase)) return (Catalog.NoError, Quality.Valid);
            return ErrorCode().IsMatch(payload) ? (payload, Quality.Valid) : (null, Quality.Unknown);
        }
        if (metric.Type == "enum")
        {
            if (!int.TryParse(payload, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var state)
                || state < 0) return (null, Quality.Invalid);
            return state <= metric.MaxEnum ? (state, Quality.Valid) : (null, Quality.Unknown);
        }
        if (!double.TryParse(payload, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
            || !double.IsFinite(number) || (metric.Type == "positive" && number < 0)) return (null, Quality.Invalid);
        if (metric.Type == "ds18b20" && (number is < -55 or > 125)) return (null, Quality.Invalid);
        if (metric.Type == "curve") {
            var field = HeatingCurve.Fields.Single(f => f.Key == metric.Key);
            if (number != Math.Truncate(number) || number < field.Minimum || number > field.Maximum) return (null, Quality.Invalid);
        }
        if (metric.Type == "dhwDelta" && (number < -12 || number > -2 || number != Math.Truncate(number))) return (null, Quality.Invalid);
        if (metric.Type == "counter" && (number < 0 || number != Math.Truncate(number) || number > 9007199254740991d))
            return (null, Quality.Invalid);
        return (number, Quality.Valid);
    }

    public Snapshot Read()
    {
        lock (gate)
        {
            var now = clock.GetUtcNow();
            var evaluated = Catalog.Metrics.Select(m => values[m.Key])
                .Concat(values.Values.Where(v => v.Key.StartsWith(OneWire.KeyPrefix, StringComparison.Ordinal)).OrderBy(v => v.Key, StringComparer.Ordinal))
                .Select(v => Current(v, now)).ToList();
            var spreadValue = EvaluateSpread(now);
            evaluated.Add(spreadValue);
            evaluated.Add(ExtraCop.Calculate(evaluated, now, sourceKind));
            AppendAlternativePower(evaluated, now);
            // Z1 heat request is also used for water targets/curve shifts. Only a
            // fresh room-sensor mode may turn it into a room temperature setpoint.
            var request = evaluated.Single(v => v.Key == "zone1HeatRequest");
            var sensor = evaluated.Single(v => v.Key == "zone1SensorMode");
            var roomMode = sensor.Quality == Quality.Valid && sensor.Value is int sensorMode && sensorMode == 2;
            var targetCompatible = roomMode && request.Quality == Quality.Valid
                && Math.Abs((request.ReceivedAtUtc!.Value - sensor.ReceivedAtUtc!.Value).TotalSeconds) <= policy.MaxPairSeconds;
            evaluated.Add(new("indoorTargetTemperature", targetCompatible ? request.Value : null,
                Catalog.Celsius, targetCompatible ? Quality.Valid : Quality.Unknown,
                targetCompatible ? request.ReceivedAtUtc : null, null, false,
                targetCompatible ? request.SourceTopic : null, sourceKind));
            var qualities = evaluated.Take(Catalog.Metrics.Count).Select(v => v.Quality).ToArray();
            var freshness = qualities.All(q => q == Quality.Valid) ? Quality.Valid :
                qualities.Contains(Quality.Invalid) ? Quality.Invalid :
                qualities.Contains(Quality.Stale) ? Quality.Stale : Quality.Unknown;
            if (spreadValue.Quality == Quality.Invalid) freshness = Quality.Invalid;
            return new(++revision, InstanceId, now, connected, availability, freshness, evaluated.AsReadOnly()) { Diagnostics = diagnostics.Values.ToArray() };
        }
    }

    private void RecordDiagnostic(string key, string message)
    {
        diagnostics.TryGetValue(key, out var old);
        diagnostics[key] = new(key, (old?.Count ?? 0) + 1, clock.GetUtcNow(), message);
    }

    private TelemetryValue Current(TelemetryValue value, DateTimeOffset now) =>
        value.Quality == Quality.Valid && (now - value.ReceivedAtUtc > TimeSpan.FromSeconds(
                value.Key.StartsWith(OneWire.KeyPrefix, StringComparison.Ordinal) ? 330 : policy.FreshSeconds)
            || !connected || availability == Availability.Offline)
            ? value with { Quality = Quality.Stale } : value;

    private TelemetryValue EvaluateSpread(DateTimeOffset now)
    {
        var flow = Current(values["flowTemperature"], now);
        var back = Current(values["returnTemperature"], now);
        var compatible = flow.Quality == Quality.Valid && back.Quality == Quality.Valid
            && Math.Abs((flow.ReceivedAtUtc!.Value - back.ReceivedAtUtc!.Value).TotalSeconds) <= policy.MaxPairSeconds;
        double? spread = compatible ? (double)flow.Value! - (double)back.Value! : null;
        var quality = !compatible ? Quality.Unknown : double.IsFinite(spread!.Value) ? Quality.Valid : Quality.Invalid;
        if (flow != spreadFlowInput || back != spreadReturnInput)
        {
            spreadFlowInput = flow;
            spreadReturnInput = back;
            if (quality == Quality.Valid)
                lastSpread = new("temperatureSpread", spread, Catalog.Kelvin, Quality.Valid,
                    flow.ReceivedAtUtc < back.ReceivedAtUtc ? flow.ReceivedAtUtc : back.ReceivedAtUtc,
                    null, false, null, sourceKind);
            else
                RecordDiagnostic("temperatureSpread", "Spreizung verworfen: " +
                    (quality == Quality.Invalid ? "Berechnung nicht endlich." :
                    flow.Value is null || back.Value is null ? "Vorlauf oder Rücklauf fehlt oder ist ungültig." :
                    flow.Quality != Quality.Valid || back.Quality != Quality.Valid ? "Vorlauf oder Rücklauf nicht aktuell." :
                    "Empfangszeiten von Vorlauf und Rücklauf nicht kompatibel.") +
                    " Letzter gültiger Wert und Empfangszeit bleiben unverändert.");
        }
        return lastSpread is not null ? Current(lastSpread, now) :
            new("temperatureSpread", null, Catalog.Kelvin, quality, null, null, false, null, sourceKind);
    }

    [GeneratedRegex("^[HF][0-9]{2}$", RegexOptions.CultureInvariant)]
    private static partial Regex ErrorCode();
}
