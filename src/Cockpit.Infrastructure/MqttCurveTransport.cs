using Cockpit.Application;
using Cockpit.Domain;
using MQTTnet;
using MQTTnet.Protocol;

namespace Cockpit.Infrastructure;

public sealed record CurveControlOptions
{
    public bool Enabled { get; init; }
    public bool Continuous { get; init; }
    public bool ConnectionEnabled { get; init; } = true;
    public bool ScalarCommands { get; init; }
    public bool ExtendedControlsEnabled { get; init; }
    public bool SterilizationEnabled { get; init; }
    public bool ProfileConfirmed { get; init; }
    public DateTimeOffset? ExpiresUtc { get; init; }
    public bool AllowSharedCredentials { get; init; }
    public string? Username { get; init; }
    public string? Password { get; init; }
    public void Validate(MqttReadOptions read, DateTimeOffset now)
    {
        read.Validate();
        if (!read.IsolatedTestBroker && !ProfileConfirmed) throw new ArgumentException("Heating curve requires confirmed L-series profile and installation settings.");
        if (!Enabled || !Continuous && (ExpiresUtc is null || ExpiresUtc > now.AddHours(1)))
            throw new ArgumentException("Live test requires an explicit expiry no more than one hour ahead.");
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrEmpty(Password) || (!AllowSharedCredentials && Username == read.Username))
            throw new ArgumentException("Live test requires credentials; shared credentials require explicit opt-in.");
    }
}

// Opt-in heating curve transport. No subscriptions, retained messages, queue or publish retry.
public sealed class MqttCurveTransport : ICurveTransport, ICommandTransport, IDisposable
{
    private readonly IMqttClient client = new MqttClientFactory().CreateMqttClient();
    private readonly SemaphoreSlim sending = new(1,1);
    private readonly MqttReadOptions read;
    private readonly CurveControlOptions options;
    private readonly TimeProvider clock;
    private long epoch;

    public bool Connected => client.IsConnected && (options.Continuous || clock.GetUtcNow() < options.ExpiresUtc);
    public long ConnectionEpoch => Interlocked.Read(ref epoch);
    public MqttCurveTransport(MqttReadOptions read, CurveControlOptions options, TimeProvider? clock = null)
    {
        this.clock = clock ?? TimeProvider.System;
        options.Validate(read,this.clock.GetUtcNow());
        this.read=read; this.options=options;
        client.ConnectedAsync += _ => { Interlocked.Increment(ref epoch); return Task.CompletedTask; };
        client.DisconnectedAsync += _ => { Interlocked.Increment(ref epoch); return Task.CompletedTask; };
    }
    public async Task RunAsync(CancellationToken token)
    {
        if (!options.ConnectionEnabled) return;
        var builder = new MqttClientOptionsBuilder().WithTcpServer(read.Host,read.Port)
            .WithClientId("cockpit-curve-write-"+Guid.NewGuid().ToString("N"))
            .WithCleanSession().WithTimeout(TimeSpan.FromSeconds(5))
            .WithCredentials(options.Username,options.Password);
        if (read.UseTls == true) builder.WithTlsOptions(tls => tls.UseTls());
        var connection = builder.Build();
        try
        {
            while (!token.IsCancellationRequested && (options.Continuous || clock.GetUtcNow() < options.ExpiresUtc))
            {
                try
                {
                    await client.ConnectAsync(connection,token);
                    while (Connected) await Task.Delay(250,token);
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested) { break; }
                catch (Exception) { /* Connection details and credentials must never reach logs. */ }
                if ((options.Continuous || clock.GetUtcNow() < options.ExpiresUtc)) await Task.Delay(2000,token);
            }
        }
        finally
        {
            if (client.IsConnected)
            {
                using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                try { await client.DisconnectAsync(new MqttClientDisconnectOptions(),stop.Token); } catch (Exception) { }
            }
        }
    }
    public async Task SendAsync(string part, CurveValues values)
    {
        var command = HeatingCurve.Command(part);
        var payload = HeatingCurve.Payload(part,values);
        if (!await sending.WaitAsync(0)) throw new CommandRejected(409,"command_pending");
        try
        {
            if (!Connected) throw new CommandRejected(403,"window_closed");
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.PublishAsync(new MqttApplicationMessageBuilder()
                .WithTopic(read.Prefix+"/commands/"+command).WithPayload(payload)
                .WithRetainFlag(false).WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce).Build(),deadline.Token);
        }
        finally { sending.Release(); }
    }
    async Task ICommandTransport.SendAsync(string key, double value)
    {
        if (!options.Continuous || !options.ScalarCommands) throw new CommandRejected(403,"live_parameter_blocked");
        var parameter = key == "sterilizationState" && options.SterilizationEnabled ? SimulatorParameter.SterilizationStart : SimulatorParameter.All.Concat(options.SterilizationEnabled ? SimulatorParameter.SterilizationSettings : []).Concat(options.ExtendedControlsEnabled ? SimulatorParameter.Extended : []).SingleOrDefault(p => p.Key == key);
        if (parameter is null || !double.IsFinite(value) || value != Math.Truncate(value) || value < parameter.Minimum || value > parameter.Maximum)
            throw new CommandRejected(422,"invalid_command");
        if (value % parameter.Step != 0) throw new CommandRejected(422,"invalid_step");
        var command = key switch { "zone1HeatRequest" => "SetZ1HeatRequestTemperature", "quietMode" => "SetQuietMode", "operatingMode" => "SetOperationMode", "dhwTargetTemperature" => "SetDHWTemp", "dhwHeatDelta" => "SetDHWHeatDelta", "sterilizationState" => "SetForceSterilization", "sterilizationTemperature" => "SetSterilizationTemp", "sterilizationMaxTime" => "SetSterilizationMaxTime", _ => throw new CommandRejected(422,"invalid_command") };
        if (!await sending.WaitAsync(0)) throw new CommandRejected(409,"command_pending");
        try {
            if (!Connected) throw new CommandRejected(409,"state_unavailable");
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.PublishAsync(new MqttApplicationMessageBuilder()
                .WithTopic(read.Prefix+"/commands/"+command)
                .WithPayload(value.ToString(System.Globalization.CultureInfo.InvariantCulture))
                .WithRetainFlag(false).WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce).Build(),deadline.Token);
        } finally { sending.Release(); }
    }
    public void Dispose() { client.Dispose(); sending.Dispose(); }
}
