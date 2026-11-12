using Cockpit.Domain;
namespace Cockpit.Application;
public sealed class RelayService(TelemetryStore store, ICommandTransport transport, Func<bool> enabled, ControlSendGate? permissionGate = null)
{
    private readonly ControlSendGate permission = permissionGate ?? new();
    private readonly SemaphoreSlim one = new(1, 1);
    private readonly SemaphoreSlim two = new(1, 1);
    public async Task<bool> SwitchAsync(string relay, int value)
    {
        var key = relay switch { "one" => "relayOne", "two" => "relayTwo", _ => throw new CommandRejected(422, "invalid_relay") };
        if (value is not (0 or 1)) throw new CommandRejected(422, "invalid_command");
        var gate = relay == "one" ? one : two;
        if (!await gate.WaitAsync(0)) throw new CommandRejected(409, "command_pending");
        try {
            if (!enabled()) throw new CommandRejected(403, "control_disabled");
            var snapshot = store.Read();
            var state = snapshot.Values.Single(v => v.Key == key);
            if (!store.RelayKnownForConnection(key) || !transport.Connected || !snapshot.BrokerConnected || snapshot.DeviceAvailability == Availability.Offline
                || state.Value is not int || state.Quality is Quality.Unknown or Quality.Invalid)
                throw new CommandRejected(409, "state_unavailable");
            if ((int)state.Value == value) throw new CommandRejected(409, "state_unchanged");
            var epoch = store.ConnectionEpoch;
            var writerEpoch = transport.ConnectionEpoch;
            var sentAt = default(DateTimeOffset);
            await permission.RunAsync(async () => {
                if (!enabled()) throw new CommandRejected(403, "control_disabled");
                var latest = store.Read();
                if (!latest.BrokerConnected || !store.RelayKnownForConnection(key) || store.ConnectionEpoch != epoch || transport.ConnectionEpoch != writerEpoch)
                    throw new CommandRejected(409, "state_unavailable");
                var current = latest.Values.Single(v => v.Key == key);
                if (current.Value is not int actual || current.Quality is Quality.Unknown or Quality.Invalid)
                    throw new CommandRejected(409, "state_unavailable");
                if (actual == value) throw new CommandRejected(409, "state_unchanged");
                sentAt = DateTimeOffset.UtcNow;
                await transport.SendAsync(key, value);
            });
            do {
                var next = store.Read();
                var feedback = next.Values.Single(v => v.Key == key);
                if (!next.BrokerConnected || !transport.Connected || store.ConnectionEpoch != epoch || transport.ConnectionEpoch != writerEpoch) return false;
                if (!feedback.Retained && feedback.Quality == Quality.Valid && feedback.ReceivedAtUtc >= sentAt && feedback.Value is int actual && actual == value) return true;
                await Task.Delay(25);
            } while (DateTimeOffset.UtcNow < sentAt.AddSeconds(3));
            return false;
        } finally { gate.Release(); }
    }
}
