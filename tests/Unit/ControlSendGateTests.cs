using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;

public sealed class ControlSendGateTests
{
    [Fact]
    public async Task DisablingWaitsForAnInFlightSendAndLaterSendsSeeDisabledState()
    {
        var gate = new ControlSendGate();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var finish = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var enabled = true;
        var send = gate.RunAsync(async () => { Assert.True(enabled); entered.SetResult(); await finish.Task; });
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        var disable = gate.RunAsync(() => { enabled = false; return Task.CompletedTask; });
        Assert.False(disable.IsCompleted);
        finish.SetResult();
        await Task.WhenAll(send, disable).WaitAsync(TimeSpan.FromSeconds(5));
        await gate.RunAsync(() => { Assert.False(enabled); return Task.CompletedTask; });
    }

    [Fact]
    public async Task EnablingControlSwitchesAnInvalidSimulatorScenarioToNormal()
    {
        var enabled = false;
        var store = new TelemetryStore(SourceKind.Simulator);
        var simulator = new SimulatorSource("invalid", dynamicControl: () => enabled);
        using var stop = new CancellationTokenSource();
        var run = simulator.RunAsync(store, stop.Token);
        try {
            Assert.NotEqual(Quality.Valid, store.Read().Values.Single(value => value.Key == "flowTemperature").Quality);
            enabled = true;
            for (var i = 0; i < 40 && store.Read().Values.Single(value => value.Key == "flowTemperature").Quality != Quality.Valid; i++)
                await Task.Delay(100);
            Assert.Equal(Quality.Valid, store.Read().Values.Single(value => value.Key == "flowTemperature").Quality);
        } finally { stop.Cancel(); try { await run; } catch (OperationCanceledException) { } }
    }
}
