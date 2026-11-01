using System.Text.Json;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using Microsoft.AspNetCore.DataProtection;

public sealed record MqttSettingsInput(string Host, int Port, string Prefix, bool UseTls, string CredentialAction, string? Username, string? Password, long Revision);
public sealed record SavedMqttSettings(MqttReadOptions Options, long Revision);

// The encrypted settings and data-protection keys are kept in a service-private directory.
public sealed class MqttSettingsStore
{
    private readonly object gate = new();
    private readonly string filePath;
    private readonly IDataProtector protector;
    private SavedMqttSettings current;
    public event Action? Changed;
    public MqttSettingsStore(string directory, MqttReadOptions defaults)
    {
        directory = Path.GetFullPath(directory);
        if (OperatingSystem.IsWindows()) Directory.CreateDirectory(directory);
        else
        {
            Directory.CreateDirectory(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            var mode = File.GetUnixFileMode(directory);
            if ((mode & (UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute | UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute)) != 0)
                throw new InvalidOperationException("The MQTT secret directory must be accessible only to its owner.");
        }
        filePath = Path.Combine(directory, "mqtt.protected");
        protector = DataProtectionProvider.Create(new DirectoryInfo(directory), options => options.SetApplicationName("heishamon-cockpit")).CreateProtector("mqtt-settings-v1");
        current = File.Exists(filePath)
            ? JsonSerializer.Deserialize<SavedMqttSettings>(protector.Unprotect(File.ReadAllText(filePath))) ?? throw new InvalidDataException("Invalid protected MQTT settings.")
            : new(defaults, 0);
    }
    public SavedMqttSettings Read() { lock (gate) return current; }
    public SavedMqttSettings Save(MqttSettingsInput input)
    {
        SavedMqttSettings next;
        lock (gate)
        {
            if (input.Revision != current.Revision) throw new CommandRejected(409, "mqtt_conflict");
            if (input.CredentialAction is not ("keep" or "replace" or "clear")) throw new CommandRejected(422, "invalid_mqtt_settings");
            if (input.CredentialAction == "replace" && (string.IsNullOrWhiteSpace(input.Username) || input.Username.Length > 256 || string.IsNullOrEmpty(input.Password) || input.Password.Length > 1024 || input.Username.Any(char.IsControl)))
                throw new CommandRejected(422, "invalid_mqtt_settings");
            var options = current.Options with {
                Host = input.Host, Port = input.Port, Prefix = input.Prefix, UseTls = input.UseTls,
                LiveReadOnly = !current.Options.IsolatedTestBroker,
                Username = input.CredentialAction == "keep" ? current.Options.Username : input.CredentialAction == "clear" ? null : input.Username,
                Password = input.CredentialAction == "keep" ? current.Options.Password : input.CredentialAction == "clear" ? null : input.Password
            };
            try { options.Validate(); } catch (ArgumentException) { throw new CommandRejected(422, "invalid_mqtt_settings"); }
            next = new(options, checked(current.Revision + 1));
            var temporary = filePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                var payload = protector.Protect(JsonSerializer.Serialize(next));
                var fileOptions = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
                if (!OperatingSystem.IsWindows()) fileOptions.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
                using (var stream = new FileStream(temporary, fileOptions))
                using (var writer = new StreamWriter(stream)) { writer.Write(payload); writer.Flush(); stream.Flush(true); }
                File.Move(temporary, filePath, true); current = next;
            }
            catch (IOException) { throw new CommandRejected(503, "mqtt_settings_unavailable"); }
            catch (UnauthorizedAccessException) { throw new CommandRejected(503, "mqtt_settings_unavailable"); }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
        Changed?.Invoke();
        return next;
    }
}

public sealed class ReloadingMqttSource(MqttSettingsStore settings) : Cockpit.Application.IReadOnlyTelemetrySource
{
    public async Task RunAsync(Cockpit.Application.TelemetryStore store, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            using var reload = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            void Changed() { try { reload.Cancel(); } catch (ObjectDisposedException) { } }
            settings.Changed += Changed;
            try
            {
                var options = settings.Read().Options;
                await new MqttReadSource(options).RunAsync(store, reload.Token);
            }
            catch (OperationCanceledException) when (reload.IsCancellationRequested) { }
            finally { settings.Changed -= Changed; store.SetConnection(false); }
        }
    }
}

public static class MqttSettingsApi
{
    public static void MapMqttSettings(this WebApplication app, bool commandModeEnabled, string source)
    {
        static object Public(SavedMqttSettings settings) => new { settings.Options.Host, settings.Options.Port, settings.Options.Prefix, settings.Options.UseTls,
            credentialsConfigured = !string.IsNullOrEmpty(settings.Options.Username), settings.Revision };
        var group = app.MapGroup("/api/v1/settings/mqtt").RequireAuthorization("admin");
        group.MapGet("", (MqttSettingsStore store) => Results.Ok(Public(store.Read())));
        group.MapPost("", (MqttSettingsInput input, MqttSettingsStore store, ControlSetupStore control) => {
            lock (store) {
                if (commandModeEnabled || source == "mqtt" && control.Read().Enabled) throw new CommandRejected(409, "mqtt_control_active");
                return Results.Ok(Public(store.Save(input)));
            }
        }).RequireRateLimiting("commands");
    }
}
