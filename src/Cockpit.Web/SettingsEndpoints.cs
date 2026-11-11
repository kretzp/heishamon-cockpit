using Cockpit.Application;
using Cockpit.Infrastructure.Persistence;

public sealed record SettingsInput(string PlantName, int RetentionDays, long Revision, bool ConfirmReduction, AlternativePowerOptions? AlternativePower = null);
public static class SettingsEndpoints
{
    public static void MapSettings(this WebApplication app, bool enabled, HistoryPolicy active, string source)
    {
        app.MapGet("/api/v1/settings", (AppSettingsStore settings) => {
            var values = settings.Read();
            return Results.Ok(new { values, enabled, source, sampleSeconds = active.SampleSeconds,
                activeRetentionDays = active.RetentionDays, restartRequired = values.RetentionDays != active.RetentionDays });
        });
        if (!enabled) return;
        app.MapPost("/api/v1/settings", (SettingsInput input, AppSettingsStore settings) => {
            if (input.RetentionDays < active.RetentionDays && !input.ConfirmReduction)
                throw new Cockpit.Domain.CommandRejected(422, "retention_confirmation_required");
            return Results.Ok(settings.Save(new(input.PlantName, input.RetentionDays, input.Revision)
            { AlternativePower = input.AlternativePower ?? settings.Read().AlternativePower }, input.ConfirmReduction));
        }).RequireAuthorization("admin").RequireRateLimiting("commands");
    }
}
