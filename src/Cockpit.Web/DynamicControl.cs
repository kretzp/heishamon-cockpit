using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;

// Serializes changes to the permission with every publish. A completed disable
// therefore cannot be followed by a publish from an earlier confirmation.
public sealed class DynamicControl(string source, ControlSetupStore settings, MqttSettingsStore mqtt, ISimulatorCommands simulator, TelemetryStore telemetry, CommandCoordinator coordinator) : BackgroundService, ICommandTransport, ICurveTransport
{
    private readonly ControlSendGate gate = new();
    private readonly object stateGate = new();
    private MqttCurveTransport? writer;
    private long writerRevision = -1;
    private long generation;

    public bool Active {
        get {
            var current = settings.Read();
            return current.Enabled && current.BrokerBinding == ControlSetupStore.Binding(source, mqtt.Read().Options);
        }
    }
    public bool Connected { get { lock (stateGate) return Active && (source == "simulator" || writerRevision == settings.Read().Revision && writer?.Connected == true); } }
    public long ConnectionEpoch { get { lock (stateGate) return unchecked(generation * 1000003 + (writer?.ConnectionEpoch ?? 0)); } }

    public Task<ControlSetup> SaveAsync(ControlSetupInput input, bool externalMode) => gate.RunAsync(() => {
            lock (mqtt) return telemetry.Guarded(() => {
                if (input.Enabled && !settings.Read().Enabled && coordinator.HasPending)
                    throw new CommandRejected(409, "control_command_pending");
                var saved = settings.Save(input, source, mqtt.Read().Options, externalMode);
                lock (stateGate) generation++;
                return Task.FromResult(saved);
            });
    });

    private Task Send(Func<MqttCurveTransport, Task> mqttSend, Func<Task> simulatedSend)
    {
        var requestedRevision = settings.Read().Revision;
        return gate.RunAsync(async () => {
            if (!Active || settings.Read().Revision != requestedRevision) throw new CommandRejected(403, "control_disabled");
            if (source == "simulator") { await simulatedSend(); return; }
            MqttCurveTransport? current; lock (stateGate) current = writer;
            if (current is null || !Connected) throw new CommandRejected(409, "state_unavailable");
            await mqttSend(current);
        });
    }
    Task ICommandTransport.SendAsync(string key, double value) => Send(w => ((ICommandTransport)w).SendAsync(key, value), () => new SimulatorCommandTransport(simulator).SendAsync(key, value));
    Task ICurveTransport.SendAsync(string part, CurveValues values) => Send(w => w.SendAsync(part, values), () => new SimulatorCurveTransport(simulator).SendAsync(part, values));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (source != "mqtt") return;
        long lastRevision = -1; CancellationTokenSource? cancellation = null; Task? running = null;
        try {
            while (!stoppingToken.IsCancellationRequested) {
                var current = settings.Read();
                if (current.Revision != lastRevision) {
                    cancellation?.Cancel();
                    if (running is not null) try { await running; } catch (OperationCanceledException) { }
                    lock (stateGate) { writer?.Dispose(); writer = null; writerRevision = -1; generation++; }
                    cancellation?.Dispose(); cancellation = null; running = null;
                    lastRevision = current.Revision;
                    if (Active) {
                        var read = mqtt.Read().Options;
                        var options = new CurveControlOptions { Enabled = true, Continuous = true, ScalarCommands = true, SterilizationEnabled = true, ExtendedControlsEnabled = true, ProfileConfirmed = true, ConnectionEnabled = true, AllowSharedCredentials = true, Username = read.Username, Password = read.Password };
                        var next = new MqttCurveTransport(read, options);
                        lock (stateGate) { writer = next; writerRevision = current.Revision; }
                        cancellation = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        running = next.RunAsync(cancellation.Token);
                    }
                }
                await Task.Delay(200, stoppingToken);
            }
        } finally {
            cancellation?.Cancel();
            if (running is not null) try { await running; } catch (OperationCanceledException) { }
            lock (stateGate) { writer?.Dispose(); writer = null; writerRevision = -1; generation++; }
            cancellation?.Dispose();
        }
    }
}
