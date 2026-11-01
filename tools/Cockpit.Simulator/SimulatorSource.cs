using Cockpit.Application;
using Cockpit.Domain;

namespace Cockpit.Simulator;

// Entirely in-process: this source never opens a socket.
public sealed class SimulatorSource(string scenario = "cycle", bool controlEnabled = false, string commandOutcome = "match", Func<bool>? dynamicControl = null) : IReadOnlyTelemetrySource, ISimulatorCommands
{
    private bool ControlEnabled => controlEnabled || dynamicControl?.Invoke() == true;
    public static readonly string[] Scenarios = ["cycle", "normal", "unknown", "invalid", "retained", "stale", "offline", "disconnected", "reconnect", "no-error", "no-error-retained"];
    private static readonly string[] Normal = ["34.5", "30.0", "7.5", "48.2", "50", "18.6", "42", "1", "4", "0", "0", "21.5", "0", "0", "850", "0", "0", "3400", "0", "0", "22", "2", "12345", "2345", "1.6", "?", "-5", "-10", "35", "15", "25", "5", "18", "29", "0", "1750", "650", "4.44", "10.24", "0", "65", "10", "0"];

    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, double> overrides = new();
    public void SetValue(string key, double value)
    {
        if (!ControlEnabled || key != "sterilizationState" && !SimulatorParameter.All.Concat(SimulatorParameter.Extended).Concat(SimulatorParameter.SterilizationSettings).Any(p => p.Key == key) && !HeatingCurve.Fields.Any(f => f.Key == key)) throw new InvalidOperationException("Simulator control disabled.");
        if (commandOutcome == "fail") throw new InvalidOperationException("Simulated transport failure.");
        if (commandOutcome == "ignore") return;
        overrides[key] = commandOutcome == "wrong" ? value + 1 : value;
    }
    private void RefreshControls(TelemetryStore store)
    {
        if (!ControlEnabled) return;
        foreach (var item in overrides)
            store.Receive(Catalog.Metrics.Single(m => m.Key == item.Key).Suffix, item.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));
        store.Receive("main/Error", "no error");
    }
    public static void Apply(TelemetryStore store, string phase)
    {
        store.Reset();
        store.SetConnection(true);
        store.Receive("LWT", "Online");
        if (phase == "unknown") return;
        for (var i = 0; i < Catalog.Metrics.Count; i++)
            store.Receive(Catalog.Metrics[i].Suffix, Normal[i], phase == "retained");
        if (phase is "no-error" or "no-error-retained") store.Receive("main/Error", "no error", phase == "no-error-retained");
        if (phase == "invalid")
        {
            foreach (var metric in Catalog.Metrics.Where(m => m.Top is 65 or 62 or 67 or 64)) store.Receive(metric.Suffix, "NaN");
            store.Receive("main/Main_Outlet_Temp", "NaN");
            store.Receive("main/Operating_Mode_State", "-1");
        }
        if (phase == "offline") store.Receive("LWT", "Offline");
        if (phase is "disconnected" or "reconnect") store.SetConnection(false);
        if (phase == "reconnect")
        {
            store.SetConnection(true);
            store.Receive("LWT", "Online");
            store.Receive("main/Main_Outlet_Temp", "34.5", true);
        }
    }

    public async Task RunAsync(TelemetryStore store, CancellationToken cancellationToken)
    {
        if (!Scenarios.Contains(scenario)) throw new ArgumentException("Unknown simulator scenario.");
        string[] phases = scenario == "cycle"
            ? ["normal", "unknown", "invalid", "retained", "stale", "offline", "disconnected", "reconnect"] : [scenario];
        var dynamicWasActive = false;
        while (!cancellationToken.IsCancellationRequested)
            foreach (var originalPhase in phases)
            {
                var phase = dynamicControl?.Invoke() == true ? "normal" : originalPhase;
                store.Guarded(() => { if (!ControlEnabled || !store.Read().BrokerConnected) Apply(store, phase); RefreshControls(store); return true; });
                var duration = phase == "stale" ? 140 : 15;
                for (var second = 0; second < duration; second++)
                {
                    await Task.Delay(1000, cancellationToken);
                    store.Guarded(() => {
                    var dynamicActive = dynamicControl?.Invoke() == true;
                    if (dynamicActive && !dynamicWasActive) Apply(store, "normal");
                    dynamicWasActive = dynamicActive;
                    if (phase == "normal" || dynamicActive)
                        for (var i = 0; i < Catalog.Metrics.Count; i++)
                            store.Receive(Catalog.Metrics[i].Suffix, Normal[i]);
                    RefreshControls(store);
                    return true; });
                }
            }
    }
}
