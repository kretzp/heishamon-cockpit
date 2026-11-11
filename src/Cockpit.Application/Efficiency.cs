using Cockpit.Domain;

namespace Cockpit.Application;

public sealed record CopPolicy(double MinimumElectricalWatts = 200, int MaxPairSeconds = 60)
{
    public const int MaxAgeSeconds = 120;
    public const int PairSeconds = 60;
    public void Validate()
    {
        if (!double.IsFinite(MinimumElectricalWatts) || MinimumElectricalWatts is < 1 or > 10000 || MaxPairSeconds is < 0 or > 3600)
            throw new HistoryRequestException("invalid_analysis_policy", "Ungültige Effizienzkonfiguration.");
    }
}
public sealed record CopPoint(DateTimeOffset Time, string? Mode, double? Cop, double? Average, double ValidSeconds, double ExpectedSeconds);
public sealed record CopModeSeries(string Mode, IReadOnlyList<CopPoint> Points);
public sealed record CopResult(DateTimeOffset From, DateTimeOffset To, int BucketSeconds, int WindowMinutes,
    SourceKind Source, double MinimumElectricalWatts, int MaxPairSeconds,
    double ValidSeconds, double ExpectedSeconds, double? EnergyRatio, IReadOnlyList<CopPoint> Points)
{
    public string ElectricalSource { get; init; } = "heishamon-extra";
    public IReadOnlyList<CopModeSeries> Series { get; init; } = [];
}
public sealed record EnergyDay(string Date, DateTimeOffset From, DateTimeOffset To, double? Kwh,
    double ValidSeconds, double ExpectedSeconds, string Status)
{
    public double? MinOutdoorTemperatureC { get; init; }
    public int OutdoorTemperatureSamples { get; init; }
    public double? HeatpumpKwh { get; init; }
    public double? HeaterKwh { get; init; }
    public double HeatpumpValidSeconds { get; init; }
    public double HeaterValidSeconds { get; init; }
}
public sealed record EnergyResult(int Year, SourceKind Source, string Unit, string TimeZone, IReadOnlyList<EnergyDay> Days)
{
    public string ElectricalSource { get; init; } = "heishamon-extra";
    public int? MaxGapSeconds { get; init; }
}

public static class EnergyCalendar
{
    public static readonly TimeZoneInfo Berlin = TimeZoneInfo.FindSystemTimeZoneById("Europe/Berlin");
    public static DateTimeOffset Midnight(DateOnly day) => new(TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue), Berlin), TimeSpan.Zero);
}
