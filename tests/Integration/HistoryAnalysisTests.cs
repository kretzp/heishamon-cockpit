using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Xunit;

namespace Cockpit.Integration;

public sealed class HistoryAnalysisTests : IDisposable
{
    private readonly string folder = Path.Combine(Path.GetTempPath(), "cockpit-analysis-" + Guid.NewGuid().ToString("N"));
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-09-20T10:00:00Z");
    private SqliteHistoryStore Open() => new(Path.Combine(folder, "test.db"), SourceKind.Simulator, new());
    private static Snapshot Frame(int second, double flow = 35, double back = 30, int skew = 0, bool retained = false, Quality quality = Quality.Valid) =>
        new(1, Guid.NewGuid(), Start.AddSeconds(second), true, Availability.Online, quality, [
            new("flowTemperature", flow, "°C", quality, Start.AddSeconds(second), null, retained, "", SourceKind.Simulator),
            new("returnTemperature", back, "°C", Quality.Valid, Start.AddSeconds(second - skew), null, false, "", SourceKind.Simulator)]);
    [Fact]
    public async Task PairMeansUseSameCompleteRasterAndKeepSignedSpread()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(0, 30, 35), true, default);
        await store.CaptureAsync(Frame(30, 32, 37, 10), true, default);
        var result = await store.PairsAsync(new(["flowTemperature", "returnTemperature"], Start, Start.AddSeconds(60), 60), 10, default);
        var p = Assert.Single(result.Points);
        Assert.Equal(31, p.Flow); Assert.Equal(36, p.Return); Assert.Equal(-5, p.Spread);
        Assert.Equal(2, p.ValidPairs); Assert.Equal(2, p.ExpectedPairs); Assert.Equal(Quality.Valid, p.Quality);
        Assert.Equal(SourceKind.Simulator, result.Source);
    }
    [Theory]
    [InlineData(11, false, Quality.Valid)]
    [InlineData(0, true, Quality.Valid)]
    [InlineData(0, false, Quality.Stale)]
    public async Task UnpairedRetainedAndStaleValuesMakeWholeBucketUnknown(int skew, bool retained, Quality quality)
    {
        using var store = Open(); await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(0), true, default);
        await store.CaptureAsync(Frame(30, skew: skew, retained: retained, quality: quality), true, default);
        var p = Assert.Single((await store.PairsAsync(new(["flowTemperature", "returnTemperature"], Start, Start.AddSeconds(60), 60), 10, default)).Points);
        Assert.Null(p.Flow); Assert.Null(p.Return); Assert.Null(p.Spread); Assert.Equal(1, p.ValidPairs); Assert.Equal(Quality.Unknown, p.Quality);
    }
    [Fact]
    public async Task MissingPairsAndEmptyFractionalRangeAreUnknown()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await store.CaptureAsync(Frame(0, 0, 0), true, default);
        var query = new HistoryQuery(["flowTemperature", "returnTemperature"], Start, Start.AddSeconds(60), 60);
        Assert.Null(Assert.Single((await store.PairsAsync(query, 10, default)).Points).Flow);
        var p = Assert.Single((await store.PairsAsync(query with { From = Start.AddMilliseconds(1), To = Start.AddMilliseconds(2) }, 10, default)).Points);
        Assert.Null(p.Flow); Assert.Equal(0, p.ExpectedPairs);
        Assert.Equal(0, Assert.Single((await store.PairsAsync(query with { To = Start.AddSeconds(30) }, 10, default)).Points).Flow);
    }
    [Fact]
    public async Task SampledTransitionsSurviveCoarseRequestedRasterAndRespectGapsAndClippedEdges()
    {
        using var store = Open(); await store.InitializeAsync(default);
        foreach (var (sec, val, quality) in new[] { (-30, 0, Quality.Valid), (0, 1, Quality.Valid), (30, 1, Quality.Valid), (60, 0, Quality.Valid), (90, 0, Quality.Stale), (120, 1, Quality.Valid) })
            await store.CaptureAsync(Frame(sec) with { Values = [new("sterilizationState", val, "enum", quality, Start.AddSeconds(sec), null, false, "", SourceKind.Simulator)] }, true, default);
        var query = new HistoryQuery(["sterilizationState"], Start, Start.AddSeconds(180), 180);
        var result = await store.IntervalsAsync(query, default);
        Assert.Equal("sampled", result.Resolution);
        var intervals = Assert.Single(result.Series).Intervals;
        Assert.Equal(3, intervals.Count);
        Assert.Equal(Start.AddSeconds(60), intervals[0].To);
        Assert.True(intervals[0].StartObserved); Assert.True(intervals[0].EndObserved);
        Assert.False(intervals[2].StartObserved); Assert.False(intervals[2].EndObserved);
        Assert.Equal(Start.AddSeconds(150), intervals[2].To);
        var clipped = Assert.Single((await store.IntervalsAsync(query with { From = Start.AddSeconds(15), To = Start.AddSeconds(45) }, default)).Series).Intervals[0];
        Assert.False(clipped.StartObserved); Assert.False(clipped.EndObserved);
        Assert.Equal(Start.AddSeconds(15), clipped.From); Assert.Equal(Start.AddSeconds(45), clipped.To);
    }
    [Fact]
    public async Task BoundedFallbackIsExplicitAndNeverInventsTransitions()
    {
        using var store = Open(); await store.InitializeAsync(default);
        await using var connection = new SqliteConnection($"Data Source={Path.Combine(folder, "test.db")}");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            WITH RECURSIVE slots(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM slots WHERE n<100001)
            INSERT INTO Samples (Key,Time,Value,Quality,Retained) SELECT 'heatpumpState',$start+n*30,1,1,0 FROM slots
            """;
        command.Parameters.AddWithValue("$start", Start.ToUnixTimeSeconds());
        await command.ExecuteNonQueryAsync();
        var result = await store.IntervalsAsync(new(["heatpumpState"], Start, Start.AddSeconds(100002 * 30), 3600), default);
        Assert.Equal("bucketed", result.Resolution);
        Assert.NotEmpty(result.Series[0].Intervals);
        Assert.All(result.Series[0].Intervals, i => { Assert.False(i.StartObserved); Assert.False(i.EndObserved); });
    }
    [Fact]
    public async Task MissingReceptionTimeCannotFormPairAndUtcRangeIsCanonical()
    {
        using var store = Open(); await store.InitializeAsync(default);
        var frame = Frame(0);
        await store.CaptureAsync(frame with { Values = frame.Values.Select(v => v with { ReceivedAtUtc = null }).ToArray() }, true, default);
        var result = await store.PairsAsync(new(["flowTemperature", "returnTemperature"], Start.ToOffset(TimeSpan.FromHours(2)), Start.AddSeconds(30), 30), 10, default);
        Assert.Equal(TimeSpan.Zero, result.From.Offset);
        Assert.Null(Assert.Single(result.Points).Flow);
    }
    [Fact]
    public async Task UnknownAndRetainedEnumsNeverConnectAcrossMissingRaster()
    {
        using var store = Open(); await store.InitializeAsync(default);
        foreach (var (sec, value, retained) in new[] { (0, 1d, false), (30, 1d, true), (60, 99d, false), (120, 1d, false) })
            await store.CaptureAsync(Frame(sec) with { Values = [new("heatpumpState", value, "enum", Quality.Valid, Start.AddSeconds(sec), null, retained, "", SourceKind.Simulator)] }, true, default);
        var result = await store.IntervalsAsync(new(["heatpumpState"], Start, Start.AddSeconds(180), 180), default);
        Assert.Equal(2, result.Series[0].Intervals.Count);
        Assert.Equal(Start.AddSeconds(30), result.Series[0].Intervals[0].To);
        Assert.Equal(Start.AddSeconds(120), result.Series[0].Intervals[1].From);
        Assert.All(result.Series[0].Intervals, i => { Assert.False(i.StartObserved); Assert.False(i.EndObserved); });
    }
    [Theory][InlineData("relayOne")][InlineData("relayTwo")]
    public async Task RelayHistoryUsesOnOffIntervalsAndPreservesUnknownGaps(string key)
    {
        using var store = Open(); await store.InitializeAsync(default);
        foreach (var (sec, val, quality, retained) in new[] { (0, 0, Quality.Valid, false), (30, 1, Quality.Valid, false), (60, 1, Quality.Stale, true), (90, 0, Quality.Valid, false) })
            await store.CaptureAsync(Frame(sec) with { Values = [new(key, val, "enum", quality, Start.AddSeconds(sec), null, retained, "", SourceKind.Simulator)] }, true, default);
        var query = new HistoryQuery([key], Start, Start.AddSeconds(120), 120);
        var result = await store.IntervalsAsync(query, default);
        var intervals = Assert.Single(result.Series).Intervals;
        Assert.Equal(new[] { 0, 1, 0 }, intervals.Select(i => i.Value));
        Assert.Equal(Start.AddSeconds(60), intervals[1].To);
        Assert.Equal(Start.AddSeconds(90), intervals[2].From);
        var coarse = Assert.Single((await store.QueryAsync(query, default)).Series);
        Assert.Equal("stableState", coarse.Aggregation);
        Assert.Null(Assert.Single(coarse.Points).Value);
        var mixed = Assert.Single((await store.QueryAsync(query with { To = Start.AddSeconds(60), BucketSeconds = 60 }, default)).Series);
        Assert.Null(Assert.Single(mixed.Points).Value);
    }
    [Fact]
    public async Task InvalidQueriesAreRejected()
    {
        using var store = Open(); await store.InitializeAsync(default);
        var query = new HistoryQuery(["flowTemperature"], Start, Start.AddSeconds(60), 30);
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.IntervalsAsync(query, default));
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.PairsAsync(query, 10, default));
        await Assert.ThrowsAsync<HistoryRequestException>(() => store.IntervalsAsync(query with { Keys = ["heatpumpState"], To = Start }, default));
    }
    public void Dispose() { SqliteConnection.ClearAllPools(); if (Directory.Exists(folder)) Directory.Delete(folder, true); }
}
