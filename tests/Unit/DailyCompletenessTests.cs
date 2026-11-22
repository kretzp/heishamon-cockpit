using Cockpit.Application;
using Cockpit.Domain;
using Xunit;
namespace Cockpit.Unit;
public sealed class DailyCompletenessTests
{
    [Theory]
    [InlineData(19.99, 20, "partial")]
    [InlineData(20, 20, "complete")]
    [InlineData(20, 21, "partial")]
    [InlineData(20, 19, "complete")]
    public void ReclassifiesTheSameHistoricalDataWithoutChangingEnergy(double validHours, double threshold, string status)
    {
        var from = EnergyCalendar.Midnight(new(2026, 1, 10));
        var day = new EnergyDay("2026-01-10", from, from.AddDays(1), 0, validHours * 3600, 86400, "partial");
        var original = new EnergyResult(2026, SourceKind.Mqtt, "kWh", "Europe/Berlin", [day]);
        var changed = original.WithCompletenessHours(threshold);
        Assert.Equal(status, changed.Days[0].Status);
        Assert.Equal(day.Kwh, changed.Days[0].Kwh);
        Assert.Equal(day.ValidSeconds, changed.Days[0].ValidSeconds);
        Assert.Equal("partial", original.Days[0].Status);
        Assert.Equal(threshold, changed.DailyCompletenessHours);
    }
    [Theory]
    [InlineData(23)][InlineData(25)]
    public void FullyCoveredDstDaysAreComplete(double dayHours)
    {
        var from = DateTimeOffset.Parse("2026-03-28T23:00:00Z");
        var result = new EnergyResult(2026, SourceKind.Mqtt, "kWh", "Europe/Berlin",
            [new("2026-03-29", from, from.AddHours(dayHours), 1, dayHours * 3600, dayHours * 3600, "complete")]);
        Assert.Equal("complete", result.WithCompletenessHours(24).Days[0].Status);
    }
    [Theory]
    [InlineData("current")][InlineData("future")][InlineData("missing")]
    public void UnfinishedOrMissingDaysKeepTheirStatus(string status)
    {
        var from = DateTimeOffset.UtcNow;
        var result = new EnergyResult(2026, SourceKind.Mqtt, "kWh", "Europe/Berlin", [new("2026-01-01", from, from.AddDays(1), null, 0, 86400, status)]);
        Assert.Equal(status, result.WithCompletenessHours(1).Days[0].Status);
    }
}
