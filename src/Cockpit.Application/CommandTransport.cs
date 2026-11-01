using Cockpit.Domain;
namespace Cockpit.Application;

public interface ICommandTransport
{
    bool Connected { get; }
    long ConnectionEpoch { get; }
    Task SendAsync(string key, double value);
}
public sealed class SimulatorCommandTransport(ISimulatorCommands simulator) : ICommandTransport
{
    public bool Connected => true;
    public long ConnectionEpoch => 0;
    public Task SendAsync(string key, double value) { simulator.SetValue(key,value); return Task.CompletedTask; }
}
public sealed record CommandPolicy(bool LiveTest = false, DateTimeOffset? ExpiresUtc = null, bool ContinuousMqtt = false, bool SterilizationEnabled = false, bool ExtendedControlsEnabled = false)
{
    public bool IsMqtt => LiveTest || ContinuousMqtt;
    public string Source => IsMqtt ? "mqtt" : "simulator";
    public int TimeoutSeconds => IsMqtt ? 360 : 20;
    public SimulatorParameter Parameter(string type)
    {
        if (!LiveTest && ExtendedControlsEnabled && SimulatorParameter.Extended.SingleOrDefault(p => p.CommandType == type) is { } extended) return extended;
        if (!LiveTest && SterilizationEnabled && type == "startSterilization") return SimulatorParameter.SterilizationStart;
        if (!LiveTest && SterilizationEnabled && SimulatorParameter.SterilizationSettings.SingleOrDefault(p => p.CommandType == type) is { } setting) return setting;
        if (!LiveTest) return SimulatorParameter.Find(type);
        if (type != "setDhwTemperature") throw new CommandRejected(403,"live_parameter_blocked");
        return new(type,"dhwTargetTemperature","Warmwasser-Soll",51,52,Catalog.Celsius);
    }
}
