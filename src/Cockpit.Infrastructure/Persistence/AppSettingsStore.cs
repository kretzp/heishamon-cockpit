using System.Text.Json;
using Cockpit.Domain;
using Cockpit.Application;

namespace Cockpit.Infrastructure.Persistence;

public sealed record AppSettings(string PlantName, int RetentionDays, long Revision = 0)
{
    public AlternativePowerOptions AlternativePower { get; init; } = new();
    public long PowerGeneration { get; init; }
}
public sealed class AppSettingsStore
{
    public event Action<AppSettings>? Changed;
    private readonly string path;
    private readonly object gate = new();
    private AppSettings current;
    public AppSettingsStore(string path, int retentionDays)
    {
        this.path = Path.GetFullPath(path);
        current = File.Exists(path) ? JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(path))
            ?? throw new InvalidDataException("Invalid settings.") : new("HeishaMon Cockpit", retentionDays);
        Validate(current);
    }
    public AppSettings Read() { lock (gate) return current; }
    private static void Validate(AppSettings value)
    {
        if (value.AlternativePower is null) throw new CommandRejected(422, "invalid_power_settings");
        value.AlternativePower.Validate();
        if (string.IsNullOrWhiteSpace(value.PlantName) || value.PlantName.Length > 80
            || value.PlantName.Any(char.IsControl) || value.RetentionDays is < 1 or > 700 || value.Revision < 0 || value.PowerGeneration is < 0 or > 9007199254740991L)
            throw new CommandRejected(422, "invalid_settings");
    }
    public AppSettings Save(AppSettings input, bool confirmReduction)
    {
        lock (gate)
        {
            Validate(input);
            if (input.Revision != current.Revision) throw new CommandRejected(409, "settings_conflict");
            if (input.RetentionDays < current.RetentionDays && !confirmReduction)
                throw new CommandRejected(422, "retention_confirmation_required");
            var next = input with { PlantName = input.PlantName.Trim(), Revision = checked(current.Revision + 1),
                PowerGeneration = input.AlternativePower == current.AlternativePower ? current.PowerGeneration : checked(current.PowerGeneration + 1) };

            var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                { JsonSerializer.Serialize(file, next); file.Flush(true); }
                File.Move(temporary, path, true);
                current = next;
                Changed?.Invoke(next);
                return next;
            }
            catch (IOException) { throw new CommandRejected(503, "settings_unavailable"); }
            catch (UnauthorizedAccessException) { throw new CommandRejected(503, "settings_unavailable"); }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
    }
}
