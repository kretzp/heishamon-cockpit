using Cockpit.Application;
using Cockpit.Domain;
using Xunit;
namespace Cockpit.Unit;
public sealed class RelayTests
{
    private sealed class Writer : ICommandTransport
    {
        public bool Connected { get; set; } = true;
        public long ConnectionEpoch => 0;
        public int Sends { get; private set; }
        public Action<string, double>? OnSend { get; set; }
        public Task SendAsync(string key, double value) { Sends++; OnSend?.Invoke(key, value); return Task.CompletedTask; }
    }
    [Fact] public async Task RetainedStateCanSwitchAndMatchingFeedbackConfirmsWithoutRetry()
    {
        var store = new TelemetryStore(SourceKind.Mqtt);
        store.SetConnection(true); store.Receive("gpio/relay/one/state", "0", true);
        var writer = new Writer { OnSend = (_, _) => store.Receive("gpio/relay/one/state", "1") };
        var service = new RelayService(store, writer, () => true);
        Assert.True(await service.SwitchAsync("one", 1));
        Assert.Equal(1, writer.Sends);
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        Assert.Equal(1, writer.Sends);
    }
    [Fact] public async Task DisabledUnknownInvalidAndDisconnectedNeverPublish()
    {
        var store = new TelemetryStore(SourceKind.Mqtt); store.SetConnection(true);
        var writer = new Writer(); var enabled = false;
        var service = new RelayService(store, writer, () => enabled);
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        enabled = true;
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        store.Receive("gpio/relay/one/state", "2");
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        store.Receive("gpio/relay/one/state", "0", true); store.SetConnection(false);
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        Assert.Equal(0, writer.Sends);
    }
    [Fact] public async Task RetainedLwtPreservesStateButReconnectRequiresNewReceipt()
    {
        var store = new TelemetryStore(SourceKind.Mqtt); store.SetConnection(true);
        store.Receive("gpio/relay/one/state", "0", true); store.Receive("LWT", "Online", true);
        Assert.True(store.RelayKnownForConnection("relayOne"));
        Assert.Equal(0, store.Read().Values.Single(v => v.Key == "relayOne").Value);
        store.SetConnection(false); store.SetConnection(true);
        var writer = new Writer(); var service = new RelayService(store, writer, () => true);
        await Assert.ThrowsAsync<CommandRejected>(() => service.SwitchAsync("one", 1));
        Assert.Equal(0, writer.Sends);
    }
    [Fact] public async Task DisablingWhileWaitingForPermissionPreventsPublish()
    {
        var store = new TelemetryStore(SourceKind.Mqtt); store.SetConnection(true);
        store.Receive("gpio/relay/one/state", "0", true);
        var writer = new Writer(); var enabled = true; var permission = new ControlSendGate();
        var entered = new TaskCompletionSource(); var release = new TaskCompletionSource();
        var saving = permission.RunAsync(async () => { entered.SetResult(); await release.Task; enabled = false; });
        await entered.Task;
        var service = new RelayService(store, writer, () => enabled, permission);
        var switching = service.SwitchAsync("one", 1);
        release.SetResult(); await saving;
        await Assert.ThrowsAsync<CommandRejected>(() => switching);
        Assert.Equal(0, writer.Sends);
    }
    [Theory][InlineData(true)][InlineData(false)]
    public async Task StateOrConnectionChangesWhileQueuedPreventPublish(bool disconnect)
    {
        var store = new TelemetryStore(SourceKind.Mqtt); store.SetConnection(true);
        store.Receive("gpio/relay/one/state", "0", true);
        var writer = new Writer(); var permission = new ControlSendGate();
        var entered = new TaskCompletionSource(); var release = new TaskCompletionSource();
        var holding = permission.RunAsync(async () => { entered.SetResult(); await release.Task; });
        await entered.Task;
        var switching = new RelayService(store, writer, () => true, permission).SwitchAsync("one", 1);
        if (disconnect) store.SetConnection(false); else store.Receive("gpio/relay/one/state", "1");
        release.SetResult(); await holding;
        await Assert.ThrowsAsync<CommandRejected>(() => switching);
        Assert.Equal(0, writer.Sends);
    }
    [Fact] public async Task MissingFeedbackTimesOutWithoutRetry()
    {
        var store = new TelemetryStore(SourceKind.Mqtt); store.SetConnection(true);
        store.Receive("gpio/relay/two/state", "1", true);
        var writer = new Writer(); var service = new RelayService(store, writer, () => true);
        Assert.False(await service.SwitchAsync("two", 0)); Assert.Equal(1, writer.Sends);
    }
}
