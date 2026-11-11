using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record HistoryPolicy(int SampleSeconds = 30, int RetentionDays = 700)
{
    public void Validate()
    {
        if (SampleSeconds is < 5 or > 300 || 86400 % SampleSeconds != 0 || RetentionDays is < 1 or > 700)
            throw new ArgumentException("Invalid history policy.");
    }
}
public sealed class HistoryRequestException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
public sealed record HistoryQuery(string[] Keys, DateTimeOffset From, DateTimeOffset To, int BucketSeconds)
{
    public static IReadOnlyDictionary<string, Metric> Metrics { get; } = Catalog.Metrics
        .Append(new Metric("temperatureSpread", Catalog.Kelvin, "", "number"))
        .Append(new Metric("alternativeHeatpumpPower", Catalog.Watt, "", "positive"))
        .Append(new Metric("alternativeHeaterPower", Catalog.Watt, "", "positive"))
        .Append(new Metric("heishamonCop", "", "", "positive"))
        .Append(new Metric("indoorTargetTemperature", Catalog.Celsius, "", "number")).ToDictionary(m => m.Key);
    public static Metric? FindMetric(string key) => Metrics.GetValueOrDefault(key) ?? OneWire.FromKey(key);
    public void Validate(HistoryPolicy policy, bool export = false)
    {
        if (Keys.Length is < 1 or > 8 || Keys.Distinct().Count() != Keys.Length || Keys.Any(k => FindMetric(k) is null))
            throw new HistoryRequestException("invalid_keys", "Bitte 1 bis 8 unterschiedliche bekannte Messwerte wählen.");
        if (From < DateTimeOffset.UnixEpoch || To <= From || To - From > TimeSpan.FromDays(export ? 30 : 700))
            throw new HistoryRequestException("invalid_range", export ? "CSV: Zeitraum muss zwischen 0 und 30 Tagen liegen." : "Zeitraum muss zwischen 0 und 700 Tagen liegen.");
        if (BucketSeconds < policy.SampleSeconds || BucketSeconds > 86400 || BucketSeconds % policy.SampleSeconds != 0)
            throw new HistoryRequestException("invalid_bucket", "Ungültiges Zeitraster.");
        if (!export && (Math.Ceiling((To - From).TotalSeconds / BucketSeconds) + 1) * Keys.Length > 20000)
            throw new HistoryRequestException("too_many_points", "Bitte ein gröberes Zeitraster wählen (höchstens 20.000 Punkte).");
    }
}
public sealed record HistoryPoint(DateTimeOffset Time, double? Value, Quality Quality, int Samples);
public sealed record HistorySeries(string Key, string Unit, SourceKind Source, string Aggregation, IReadOnlyList<HistoryPoint> Points);
public sealed record HistoryResult(DateTimeOffset From, DateTimeOffset To, int BucketSeconds, IReadOnlyList<HistorySeries> Series);
public sealed record RecordedEvent(long Id, DateTimeOffset Time, string Kind, string Key, string Message, SourceKind Source);
public sealed record EventPage(IReadOnlyList<RecordedEvent> Items, long? NextCursor);
public sealed record StorageStatus(string State, DateTimeOffset? LastWriteUtc, int SampleSeconds, int RetentionDays);
public sealed record TemperaturePairPoint(DateTimeOffset Time, double? Flow, double? Return, double? Spread,
    Quality Quality, int ValidPairs, int ExpectedPairs);
public sealed record TemperaturePairResult(DateTimeOffset From, DateTimeOffset To, int BucketSeconds,
    SourceKind Source, int MaxPairSeconds, IReadOnlyList<TemperaturePairPoint> Points);
public sealed record StateInterval(DateTimeOffset From, DateTimeOffset To, int Value, Quality Quality,
    bool StartObserved, bool EndObserved);
public sealed record StateIntervalSeries(string Key, string Unit, SourceKind Source, string Aggregation,
    IReadOnlyList<HistoryPoint> Points, IReadOnlyList<StateInterval> Intervals);
public sealed record StateIntervalResult(DateTimeOffset From, DateTimeOffset To, int BucketSeconds,
    int SampleSeconds, string Resolution, IReadOnlyList<StateIntervalSeries> Series);
public interface IHistoryStore
{
    HistoryPolicy Policy { get; }
    Task InitializeAsync(CancellationToken token);
    Task CaptureAsync(Snapshot snapshot, bool sample, CancellationToken token);
    Task<int> PruneAsync(DateTimeOffset now, CancellationToken token);
    Task<HistoryResult> QueryAsync(HistoryQuery query, CancellationToken token);
    Task<TemperaturePairResult> PairsAsync(HistoryQuery query, int maxPairSeconds, CancellationToken token);
    Task<StateIntervalResult> IntervalsAsync(HistoryQuery query, CancellationToken token);
    Task<CopResult> CopAsync(HistoryQuery query, int windowMinutes, CopPolicy policy, CancellationToken token);
    Task<EnergyResult> EnergyAsync(int year, int maxPairSeconds, DateTimeOffset now, CancellationToken token);
    Task<EventPage> EventsAsync(long? cursor, string? kind, CancellationToken token);
    Task<string> ExportAsync(HistoryQuery query, CancellationToken token);
}
