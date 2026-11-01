using Cockpit.Application;

public sealed class HistoryWorker(IHistoryStore history, TelemetryStore telemetry) : BackgroundService
{
    private StorageStatus status = new("starting", null, history.Policy.SampleSeconds, history.Policy.RetentionDays);
    public StorageStatus Status => Volatile.Read(ref status);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var initialized = false;
        long lastSlot = -1;
        var nextPrune = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!initialized) { await history.InitializeAsync(stoppingToken); initialized = true; }
                var snapshot = telemetry.Read();
                var slot = snapshot.GeneratedAtUtc.ToUnixTimeSeconds() / history.Policy.SampleSeconds;
                await history.CaptureAsync(snapshot, slot != lastSlot, stoppingToken);
                lastSlot = slot;
                if (snapshot.GeneratedAtUtc >= nextPrune)
                {
                    var removed = await history.PruneAsync(snapshot.GeneratedAtUtc, stoppingToken);
                    nextPrune = snapshot.GeneratedAtUtc.AddSeconds(removed >= 10000 ? 1 : 3600);
                }
                Volatile.Write(ref status, new("ready", snapshot.GeneratedAtUtc.ToUniversalTime(), history.Policy.SampleSeconds, history.Policy.RetentionDays));
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                // No paths, raw payloads or credentials in public diagnostics.
                Volatile.Write(ref status, Status with { State = "failed" });
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }
}
