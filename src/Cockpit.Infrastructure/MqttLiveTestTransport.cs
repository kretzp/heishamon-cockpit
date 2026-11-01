using Cockpit.Application;
using Cockpit.Domain;
using MQTTnet;
using MQTTnet.Protocol;

namespace Cockpit.Infrastructure;

public sealed record LiveTestOptions
{
    public bool Enabled { get; init; }
    public DateTimeOffset? ExpiresUtc { get; init; }
    public bool AllowSharedCredentials { get; init; }
    public string? Username { get; init; }
    public string? Password { get; init; }
    public void Validate(MqttReadOptions read, DateTimeOffset now)
    {
        read.Validate();
        if (!Enabled || ExpiresUtc is null || ExpiresUtc > now.AddHours(1))
            throw new ArgumentException("Live test requires an explicit expiry no more than one hour ahead.");
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrEmpty(Password) || (!AllowSharedCredentials && Username == read.Username))
            throw new ArgumentException("Live test requires credentials; shared credentials require explicit opt-in.");
    }
}

// Opt-in, bounded transport. No subscriptions, retained messages, queue or publish retry.
public sealed class MqttLiveTestTransport : ICommandTransport, IDisposable
{
    private readonly IMqttClient client = new MqttClientFactory().CreateMqttClient();
    private readonly SemaphoreSlim sending = new(1,1);
    private readonly MqttReadOptions read;
    private readonly LiveTestOptions options;
    private readonly TimeProvider clock;
    private long epoch;
    private int attempts;
    public bool Connected => client.IsConnected && clock.GetUtcNow() < options.ExpiresUtc;
    public long ConnectionEpoch => Interlocked.Read(ref epoch);
    public MqttLiveTestTransport(MqttReadOptions read, LiveTestOptions options, TimeProvider? clock = null)
    {
        this.clock = clock ?? TimeProvider.System;
        options.Validate(read,this.clock.GetUtcNow());
        this.read=read; this.options=options;
        client.ConnectedAsync += _ => { Interlocked.Increment(ref epoch); return Task.CompletedTask; };
        client.DisconnectedAsync += _ => { Interlocked.Increment(ref epoch); return Task.CompletedTask; };
    }
    public async Task RunAsync(CancellationToken token)
    {
        var builder = new MqttClientOptionsBuilder().WithTcpServer(read.Host,read.Port)
            .WithClientId("cockpit-bounded-write-"+Guid.NewGuid().ToString("N"))
            .WithCleanSession().WithTimeout(TimeSpan.FromSeconds(5))
            .WithCredentials(options.Username,options.Password);
        if (read.UseTls == true) builder.WithTlsOptions(tls => tls.UseTls());
        var connection = builder.Build();
        try
        {
            while (!token.IsCancellationRequested && clock.GetUtcNow() < options.ExpiresUtc)
            {
                try
                {
                    await client.ConnectAsync(connection,token);
                    while (Connected) await Task.Delay(250,token);
                }
                catch (OperationCanceledException) when (token.IsCancellationRequested) { break; }
                catch (Exception) { /* Connection details and credentials must never reach logs. */ }
                if (clock.GetUtcNow() < options.ExpiresUtc) await Task.Delay(2000,token);
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
    public async Task SendAsync(string key, double value)
    {
        if (key != "dhwTargetTemperature" || value is not (51 or 52)) throw new CommandRejected(403,"live_parameter_blocked");
        if (!await sending.WaitAsync(0)) throw new CommandRejected(409,"command_pending");
        try
        {
            if (!Connected || attempts >= 2) throw new CommandRejected(403,"test_sequence_blocked");
            attempts++; // Secondary process guard; the application persists its budget BEFORE this call.
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.PublishAsync(new MqttApplicationMessageBuilder()
                .WithTopic(read.Prefix+"/commands/SetDHWTemp").WithPayload(value == 51 ? "51" : "52")
                .WithRetainFlag(false).WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce).Build(),deadline.Token);
        }
        finally { sending.Release(); }
    }
    public void Dispose() { client.Dispose(); sending.Dispose(); }
}
