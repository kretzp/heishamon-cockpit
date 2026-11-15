using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Cockpit.Domain;
using Cockpit.Infrastructure;

public sealed record ControlSetup(bool Enabled = false, string? Profile = null, string? BrokerBinding = null, long Revision = 0, bool AnonymousControlAccepted = false);
public sealed record ControlSetupInput(bool Enabled, string? Profile, bool ConfirmProfile, bool ConfirmSharedCredentials, bool ConfirmNoOtherWriters, long Revision, bool ConfirmAnonymousRisk = false);

public sealed class ControlSetupStore
{
    private readonly string path;
    private readonly object gate = new();
    private ControlSetup current;
    public ControlSetupStore(string path)
    {
        this.path = Path.GetFullPath(path);
        current = File.Exists(this.path) ? JsonSerializer.Deserialize<ControlSetup>(File.ReadAllText(this.path)) ?? throw new InvalidDataException("Invalid control setup.") : new();
        if (current.Revision < 0 || current.Enabled && current.Profile != HeatingCurve.Profile) throw new InvalidDataException("Invalid control setup.");
    }
    public static string Binding(string source, MqttReadOptions options)
    {
        var text = JsonSerializer.Serialize(new { source, options.Host, options.Port, options.Prefix, options.UseTls, options.IsolatedTestBroker });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    }
    public ControlSetup Read() { lock (gate) return current; }
    public ControlSetup Save(ControlSetupInput input, string source, MqttReadOptions options, bool externalMode)
    {
        lock (gate)
        {
            if (externalMode) throw new CommandRejected(409, "control_external_mode");
            if (input.Revision != current.Revision) throw new CommandRejected(409, "control_conflict");
            var anonymous = string.IsNullOrEmpty(options.Username) && string.IsNullOrEmpty(options.Password);
            var brokerAuthorized = anonymous ? input.ConfirmAnonymousRisk : input.ConfirmSharedCredentials && !string.IsNullOrWhiteSpace(options.Username) && !string.IsNullOrEmpty(options.Password);
            if (input.Enabled && (input.Profile != HeatingCurve.Profile || !input.ConfirmProfile || !input.ConfirmNoOtherWriters || source == "mqtt" && !brokerAuthorized))
                throw new CommandRejected(422, "control_confirmation_required");
            var next = new ControlSetup(input.Enabled, input.Enabled ? HeatingCurve.Profile : null, input.Enabled ? Binding(source, options) : null, checked(current.Revision + 1), input.Enabled && source == "mqtt" && anonymous && input.ConfirmAnonymousRisk);
            var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                var opts = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
                if (!OperatingSystem.IsWindows()) opts.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
                using (var stream = new FileStream(temp, opts)) { JsonSerializer.Serialize(stream, next); stream.Flush(true); }
                File.Move(temp, path, true); current = next; return next;
            }
            catch (IOException) { throw new CommandRejected(503, "control_settings_unavailable"); }
            catch (UnauthorizedAccessException) { throw new CommandRejected(503, "control_settings_unavailable"); }
            finally { if (File.Exists(temp)) File.Delete(temp); }
        }
    }
}

public static class ControlSetupApi
{
    public static void MapControlSetup(this WebApplication app, string source, bool active, bool externalMode, DynamicControl? dynamicControl = null)
    {
        static object Status(ControlSetupStore store, MqttSettingsStore mqtt, string source, bool active, bool externalMode, bool dynamicMode)
        {
            var setup = store.Read(); var read = mqtt.Read().Options;
            return new { setup.Enabled, setup.Profile, setup.Revision, active, restartRequired = !dynamicMode && setup.Enabled != active, externalMode,
                brokerMatches = !setup.Enabled || setup.BrokerBinding == ControlSetupStore.Binding(source, read), source,
                brokerHost = source == "mqtt" ? read.Host : null, brokerPort = source == "mqtt" ? read.Port : (int?)null,
                topicBase = source == "mqtt" ? read.Prefix : null, credentialsConfigured = source != "mqtt" || !string.IsNullOrWhiteSpace(read.Username) && !string.IsNullOrEmpty(read.Password) };
        }
        var group = app.MapGroup("/api/v1/settings/control").RequireAuthorization("admin");
        group.MapGet("", (ControlSetupStore store, MqttSettingsStore mqtt) => Results.Ok(Status(store, mqtt, source, dynamicControl?.Active ?? active, externalMode, dynamicControl is not null)));
        group.MapPost("", async (ControlSetupInput input, ControlSetupStore store, MqttSettingsStore mqtt) => {
            if (dynamicControl is not null) {
                await dynamicControl.SaveAsync(input, externalMode);
                return Results.Ok(Status(store, mqtt, source, dynamicControl.Active, externalMode, true));
            }
            lock (mqtt) {
                store.Save(input, source, mqtt.Read().Options, externalMode);
                return Results.Ok(Status(store, mqtt, source, active, externalMode, false));
            }
        }).RequireRateLimiting("commands");
    }
}
