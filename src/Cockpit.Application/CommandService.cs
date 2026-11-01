using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Cockpit.Domain;

namespace Cockpit.Application;

public interface ICommandJournal
{
    IReadOnlyList<CommandRecord> Read();
    void Save(CommandRecord record);
}
// Simulator transport remains separate from the opt-in bounded live test.
public interface ISimulatorCommands { void SetValue(string key, double value); }

public sealed class CommandService
{
    private readonly object gate = new();
    private readonly TelemetryStore telemetry;
    private readonly ICommandJournal journal;
    private readonly ICommandTransport transport;
    private readonly CommandPolicy policy;
    private readonly TimeProvider clock;
    private readonly Dictionary<Guid, CommandRecord> commands;
    private bool faulted;
    private readonly CommandCoordinator coordinator;
    private static bool Open(CommandRecord c) => c.State is CommandState.Draft or CommandState.Validated or CommandState.Sent;

    public CommandService(TelemetryStore telemetry, ICommandJournal journal, ISimulatorCommands simulator, TimeProvider? clock = null)
        : this(telemetry, journal, new SimulatorCommandTransport(simulator), new CommandPolicy(), clock) { }
    public CommandService(TelemetryStore telemetry, ICommandJournal journal, ICommandTransport transport, CommandPolicy policy, TimeProvider? clock = null, CommandCoordinator? coordinator = null)
    {
        this.coordinator = coordinator ?? new();
        if (policy.LiveTest && policy.ContinuousMqtt) throw new ArgumentException("Conflicting command policies.");
        this.telemetry = telemetry; this.journal = journal; this.transport = transport; this.policy = policy;
        if (policy.LiveTest && policy.ExpiresUtc is null) throw new ArgumentException("Live test requires an expiry.");
        this.clock = clock ?? TimeProvider.System;
        commands = journal.Read().ToDictionary(c => c.Id);
        if (commands.Values.Any(c => c.Source != policy.Source)) throw new ArgumentException("Command audit source mismatch.");
        foreach (var c in commands.Values.Where(Open).ToArray())
            Save(c with { State = CommandState.Cancelled, UpdatedUtc = this.clock.GetUtcNow(), Reason = "restart" });
    }
    private T Locked<T>(Func<T> action) { lock (gate) return telemetry.Guarded(action); }
    private Snapshot Snapshot() => telemetry.Read();
    private static TelemetryValue Value(Snapshot s, string key) => s.Values.Single(v => v.Key == key);
    private bool Fresh(TelemetryValue v) => v.SourceKind == (policy.IsMqtt ? SourceKind.Mqtt : SourceKind.Simulator) && v.Quality == Quality.Valid && !v.Retained;
    private static double? Number(TelemetryValue v) => v.Value switch { double d => d, int i => i, _ => null };
    private static string[] Keys(string type) => type switch {
        "setQuietMode" => ["quietMode", "activeError"],
        "setOperatingMode" => ["operatingMode", "activeError"],
        "setIndoorTemperature" => ["zone1HeatRequest", "zone1SensorMode", "zonesState", "operatingMode", "activeError"],
        "startSterilization" or "setSterilizationTemperature" or "setSterilizationMaxTime" => ["dhwTargetTemperature", "dhwHeatDelta", "operatingMode", "activeError", "sterilizationState", "sterilizationTemperature", "sterilizationMaxTime"],
        _ => ["dhwTargetTemperature", "dhwHeatDelta", "operatingMode", "activeError"]
    };
    private static bool ModeAllows(Snapshot s, string type) => type switch {
        "setQuietMode" => true,
        "setOperatingMode" => Value(s,"operatingMode").Value is int mode && mode is >= 0 and <= 8,
        "setIndoorTemperature" => Value(s,"operatingMode").Value is int mode && mode is 0 or 2 or 4 or 6
            && Value(s,"zone1SensorMode").Value is int sensor && sensor == 2
            && Value(s,"zonesState").Value is int zone && zone is 0 or 2
            && Value(s,"indoorTargetTemperature").Quality == Quality.Valid,
        "startSterilization" => Value(s,"operatingMode").Value is int mode && mode is 3 or 4 or 5 or 6 or 8,
        _ => true
    };
    private bool Available(Snapshot s, string type) => !faulted && !coordinator.BlockedFor("scalar") && transport.Connected && s.BrokerConnected && s.DeviceAvailability == Availability.Online
        && Keys(type).All(k => Fresh(Value(s, k)))
        && Value(s, "activeError").Value is string error && error == Catalog.NoError
        && ModeAllows(s,type)
        && (type != "startSterilization" || Number(Value(s,"sterilizationTemperature")) > 0 && Number(Value(s,"sterilizationMaxTime")) > 0)
        && (!policy.LiveTest || (Value(s,"dhwHeatDelta").Value is double delta && delta == -8));
    private string Revision(Snapshot s, string type) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
        s.InstanceId, telemetry.ConnectionEpoch, TransportEpoch = transport.ConnectionEpoch, s.BrokerConnected, s.DeviceAvailability,
        Values = Keys(type).Select(k => new { Value(s,k).Value, Value(s,k).Quality, Value(s,k).Retained })
    }))));
    public CommandContext Context(string type) => Locked(() => { var p = policy.Parameter(type); var s = Snapshot(); return new CommandContext(Revision(s,type), Number(Value(s,p.Key)), Available(s,type) && CanStart(s) && (type != "startSterilization" || Number(Value(s,p.Key)) == 0), p.Minimum, p.Maximum, p.Step, p.Unit) { Source = policy.Source, TimeoutSeconds = policy.TimeoutSeconds, ExpiresUtc = policy.ExpiresUtc, RemainingSends = policy.LiveTest ? Math.Max(0,2-Attempts()) : null }; });
    public IReadOnlyList<CommandRecord> List() => Locked(() => commands.Values.OrderByDescending(c => c.CreatedUtc).Take(100).ToArray());
    public CommandRecord Get(Guid id) => Locked(() => commands.TryGetValue(id, out var c) ? c : throw new CommandRejected(404,"command_not_found"));
    private void Save(CommandRecord record)
    {
        if (Open(record)) coordinator.Acquire(record.Id, "scalar");
        try { journal.Save(record); commands[record.Id] = record; if (!Open(record)) coordinator.Release(record.Id); }
        catch { coordinator.Fault(); faulted = true; throw new CommandRejected(503,"audit_unavailable"); }
    }
    private int Attempts() => commands.Values.Count(c => c.SentUtc is not null);
    private bool WindowOpen() => !policy.LiveTest || clock.GetUtcNow() < policy.ExpiresUtc;
    private bool CanStart(Snapshot s) => !policy.LiveTest || (WindowOpen() && Attempts() < 2
        && Value(s,"dhwTargetTemperature").Value is double value && value == (Attempts() == 0 ? 52 : 51));
    private void Validate(Snapshot s, string expected, string type)
    {
        if (faulted) throw new CommandRejected(503,"audit_unavailable");
        if (!WindowOpen()) throw new CommandRejected(403,"test_window_closed");
        if (!Available(s,type)) throw new CommandRejected(409,"state_unavailable");
        if (Revision(s,type) != expected) throw new CommandRejected(409,"state_conflict");
    }
    public CommandRecord Prepare(string user, CommandRequest request) => Locked(() => {
        var parameter = policy.Parameter(request.CommandType);
        if (request.IdempotencyKey == Guid.Empty || !double.IsFinite(request.DesiredValue)
            || request.DesiredValue < parameter.Minimum || request.DesiredValue > parameter.Maximum || request.DesiredValue != Math.Truncate(request.DesiredValue))
            throw new CommandRejected(422,"invalid_command");
        if (request.DesiredValue % parameter.Step != 0) throw new CommandRejected(422,"invalid_step");
        var prior = commands.Values.FirstOrDefault(c => c.User == user && c.IdempotencyKey == request.IdempotencyKey);
        if (prior is not null)
        {
            if (prior.CommandType != request.CommandType || prior.DesiredValue != request.DesiredValue || prior.ExpectedStateRevision != request.ExpectedStateRevision)
                throw new CommandRejected(409,"idempotency_conflict");
            return prior;
        }
        var s = Snapshot(); Validate(s, request.ExpectedStateRevision, request.CommandType);
        if (!CanStart(s)) throw new CommandRejected(403,"test_sequence_blocked");
        if (commands.Values.Any(Open)) throw new CommandRejected(409,"command_pending");
        var old = Number(Value(s,parameter.Key))!.Value;
        if (SimulatorParameter.Comparable(request.CommandType,old) == request.DesiredValue) throw new CommandRejected(409,"unchanged_value");
        var now = clock.GetUtcNow();
        if (commands.Values.Any(c => c.SentUtc is not null && now - c.SentUtc < TimeSpan.FromSeconds(30)))
            throw new CommandRejected(429,"change_interval");
        var record = new CommandRecord(Guid.NewGuid(), request.IdempotencyKey, user, request.CommandType, old, request.DesiredValue, null,
            request.ExpectedStateRevision, CommandState.Draft, now, now, null, "draft", policy.Source);
        Save(record); record = record with { State = CommandState.Validated, Reason = "validated" }; Save(record); return record;
    });
    public CommandRecord Confirm(string user, Guid id) => ConfirmAsync(user,id).GetAwaiter().GetResult();
    public async Task<CommandRecord> ConfirmAsync(string user, Guid id)
    {
        Task? pending = null;
        var result = Locked(() => {
            var c = Get(id); if (c.User != user) throw new CommandRejected(403,"not_owner");
            if (c.State != CommandState.Validated) return c;
            try {
                var snapshot = Snapshot(); Validate(snapshot,c.ExpectedStateRevision,c.CommandType);
                if (!CanStart(snapshot)) throw new CommandRejected(403,"test_sequence_blocked");
                if (clock.GetUtcNow()-c.CreatedUtc > TimeSpan.FromSeconds(60)) throw new CommandRejected(409,"draft_expired");
            } catch (CommandRejected error) {
                if (!faulted) Save(c with { State=CommandState.Cancelled, Reason=error.Code, UpdatedUtc=clock.GetUtcNow() });
                throw;
            }
            var sent=c with { State=CommandState.Sent, SentUtc=clock.GetUtcNow(), UpdatedUtc=clock.GetUtcNow(), Reason=policy.IsMqtt ? "mqtt_send_attempt" : "simulator_sent" };
            Save(sent); // persisted attempt consumes the live budget BEFORE transport
            try { pending=transport.SendAsync(policy.Parameter(c.CommandType).Key,c.DesiredValue); }
            catch { Save(sent with { State=CommandState.Failed, Reason="delivery_unknown", UpdatedUtc=clock.GetUtcNow() }); }
            return commands[id];
        });
        if (pending is not null)
        {
            try { await pending; }
            catch {
                Locked(() => {
                    var c=commands[id];
                    if (c.State == CommandState.Sent) Save(c with { State=CommandState.Failed, Reason="delivery_unknown", UpdatedUtc=clock.GetUtcNow() });
                    return true;
                });
            }
            result=Get(id);
        }
        return result;
    }
    public CommandRecord Cancel(string user, Guid id) => Locked(() => {
        var c = Get(id); if (c.User != user) throw new CommandRejected(403,"not_owner");
        if (c.State is CommandState.Draft or CommandState.Validated)
            Save(c with { State = CommandState.Cancelled, Reason = "user_cancelled", UpdatedUtc = clock.GetUtcNow() });
        else if (c.State == CommandState.Sent) throw new CommandRejected(409,"already_sent");
        return commands[id];
    });
    public void Tick() => Locked(() => {
        if (faulted) return false;
        var now = clock.GetUtcNow(); var s = Snapshot();
        foreach (var c in commands.Values.Where(Open).ToArray())
        {
            if (c.State != CommandState.Sent)
            {
                if (!WindowOpen() || now - c.CreatedUtc > TimeSpan.FromSeconds(60) || Revision(s,c.CommandType) != c.ExpectedStateRevision)
                    Save(c with { State = CommandState.Cancelled, UpdatedUtc = now, Reason = "draft_expired_or_changed" });
                continue;
            }
            var target = Value(s,policy.Parameter(c.CommandType).Key);
            // Compare original context with original target substituted: mode/connection/quality changes cancel.
            var original = s with { Values = s.Values.Select(v => v.Key == target.Key ? v with { Value = v.Value is int ? (object)(int)c.OldValue : c.OldValue } : v).ToArray() };
            if (!Available(s,c.CommandType) || Revision(original,c.CommandType) != c.ExpectedStateRevision)
                Save(c with { State = CommandState.Cancelled, UpdatedUtc = now, Reason = "connection_or_state_changed" });
            else if (now - c.SentUtc >= TimeSpan.FromSeconds(10) && target.ReceivedAtUtc > c.SentUtc && Number(target) is double observed && SimulatorParameter.Comparable(c.CommandType,observed) == c.DesiredValue)
                Save(c with { State = CommandState.ObservedMatchingState, ObservedValue = observed, UpdatedUtc = now, Reason = c.CommandType == "startSterilization" ? "sterilization_active_observed" : "matching_state_observed" });
            else if (now - c.SentUtc >= TimeSpan.FromSeconds(policy.TimeoutSeconds))
                Save(c with { State = CommandState.TimedOut, ObservedValue = Number(target), UpdatedUtc = now, Reason = "no_matching_state" });
        }
        return true;
    });
}
