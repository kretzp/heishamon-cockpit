using System.Globalization;
using Cockpit.Application;

public static class HistoryEndpoints
{
    public static IResult Readiness(StorageStatus status) => status.State == "ready"
        ? Results.Ok(new { status = "ready" })
        : Results.Json(new { status = "not-ready" }, statusCode: 503);

    public static void MapHistory(this WebApplication app)
    {
        app.MapGet("/api/v1/storage", (HistoryWorker recorder) => recorder.Status);
        app.MapGet("/api/v1/history/cop", async (HttpContext context, IHistoryStore store, HistoryWorker recorder, IConfiguration configuration) =>
            await Handle(context, recorder, async () => {
                var window = context.Request.Query["windowMinutes"].ToString();
                if (!int.TryParse(window, out var minutes)) throw new HistoryRequestException("invalid_window", "Fenster muss 5, 15 oder 30 Minuten sein.");
                var policy = new CopPolicy(configuration.GetValue<double?>("Analysis:MinimumElectricalWatts") ?? 200,
                    CopPolicy.PairSeconds);
                return Results.Ok(await store.CopAsync(Parse(context, store.Policy), minutes, policy, context.RequestAborted));
            }));
        app.MapGet("/api/v1/history/energy", async (HttpContext context, IHistoryStore store, HistoryWorker recorder, IConfiguration configuration) =>
            await Handle(context, recorder, async () => {
                if (!int.TryParse(context.Request.Query["year"], out var year)) throw new HistoryRequestException("invalid_year", "Ungültiges Kalenderjahr.");
                return Results.Ok(await store.EnergyAsync(year, configuration.GetValue<int?>("Telemetry:MaxPairSeconds") ?? 10,
                    DateTimeOffset.UtcNow, context.RequestAborted));
            }));
        app.MapGet("/api/v1/history", async (HttpContext context, IHistoryStore store, HistoryWorker recorder) =>
            await Handle(context, recorder, async () => Results.Ok(await store.QueryAsync(Parse(context, store.Policy), context.RequestAborted))));
        app.MapGet("/api/v1/history/pairs", async (HttpContext context, IHistoryStore store, HistoryWorker recorder, IConfiguration configuration) =>
            await Handle(context, recorder, async () => Results.Ok(await store.PairsAsync(Parse(context, store.Policy),
                configuration.GetValue<int?>("Telemetry:MaxPairSeconds") ?? 10, context.RequestAborted))));
        app.MapGet("/api/v1/history/intervals", async (HttpContext context, IHistoryStore store, HistoryWorker recorder) =>
            await Handle(context, recorder, async () => Results.Ok(await store.IntervalsAsync(Parse(context, store.Policy), context.RequestAborted))));
        app.MapGet("/api/v1/events", async (HttpContext context, IHistoryStore store, HistoryWorker recorder) =>
            await Handle(context, recorder, async () =>
            {
                var value = context.Request.Query["cursor"].ToString();
                long? cursor = string.IsNullOrEmpty(value) ? null : long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var id) ? id
                    : throw new HistoryRequestException("invalid_cursor", "Ungültiger Cursor.");
                var kind = context.Request.Query["kind"].ToString();
                return Results.Ok(await store.EventsAsync(cursor, string.IsNullOrEmpty(kind) ? null : kind, context.RequestAborted));
            }));
        app.MapGet("/api/v1/export.csv", async (HttpContext context, IHistoryStore store, HistoryWorker recorder) =>
            await Handle(context, recorder, async () => Results.File(System.Text.Encoding.UTF8.GetBytes(
                await store.ExportAsync(Parse(context, store.Policy), context.RequestAborted)), "text/csv; charset=utf-8", "waermepumpe.csv")));
    }
    private static HistoryQuery Parse(HttpContext context, HistoryPolicy policy)
    {
        var input = context.Request.Query;
        DateTimeOffset Date(string name)
        {
            var text = input[name].ToString();
            if (!text.Contains('T') || !(text.EndsWith('Z') || System.Text.RegularExpressions.Regex.IsMatch(text, @"[+-]\d{2}:\d{2}$"))
                || !DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
                throw new HistoryRequestException("invalid_time", "Zeitpunkte müssen ISO-8601 mit Zeitzone enthalten.");
            return time;
        }
        var bucketText = input["bucketSeconds"].ToString();
        int bucket = string.IsNullOrEmpty(bucketText) ? policy.SampleSeconds : int.TryParse(bucketText, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) ? parsed
            : throw new HistoryRequestException("invalid_bucket", "Ungültiges Zeitraster.");
        return new(input["keys"].ToString().Split(',', StringSplitOptions.RemoveEmptyEntries), Date("from"), Date("to"), bucket);
    }
    private static async Task<IResult> Handle(HttpContext context, HistoryWorker recorder, Func<Task<IResult>> action)
    {
        IResult Problem(int status, string code, string message) => Results.Problem(statusCode: status, title: message,
            extensions: new Dictionary<string, object?> { ["errorCode"] = code, ["traceId"] = context.TraceIdentifier });
        if (recorder.Status.State != "ready") return Problem(503, "storage_unavailable", "Aufzeichnung nicht verfügbar; Livewerte bleiben lesbar.");
        try { return await action(); }
        catch (HistoryRequestException e) { return Problem(400, e.Code, e.Message); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { return Results.StatusCode(499); }
        catch (Exception) { return Problem(503, "storage_unavailable", "Gespeicherte Daten derzeit nicht verfügbar."); }
    }
}
