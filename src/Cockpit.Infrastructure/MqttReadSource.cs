using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Cockpit.Application;
using Cockpit.Domain;
using MQTTnet;
using MQTTnet.Protocol;

namespace Cockpit.Infrastructure;

public sealed record MqttReadOptions
{
    public string Host { get; init; } = "127.0.0.1";
    public int Port { get; init; } = 18883;
    public string Prefix { get; init; } = "cockpit_test";
    public bool IsolatedTestBroker { get; init; }
    public bool LiveReadOnly { get; init; }
    public bool? UseTls { get; init; }
    public string? Username { get; init; }
    public string? Password { get; init; }

    public void Validate()
    {
        if (LiveReadOnly == IsolatedTestBroker)
            throw new ArgumentException("Select either isolated test MQTT or live read-only MQTT.");
        if (IsolatedTestBroker && (!IPAddress.TryParse(Host, out var address) || !IPAddress.IsLoopback(address)))
            throw new ArgumentException("Test MQTT requires a literal loopback address.");
        if (string.IsNullOrWhiteSpace(Host) || Uri.CheckHostName(Host) == UriHostNameType.Unknown)
            throw new ArgumentException("Invalid MQTT host; provide a hostname or IP address without scheme or port.");
        if (LiveReadOnly && UseTls is null)
            throw new ArgumentException("Explicitly configure TLS for the live broker.");
        if (Port is < 1 or > 65535 || (IsolatedTestBroker && Port < 1024)
            || Prefix is null || !Regex.IsMatch(Prefix, "^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$") || Prefix.Length > 128)
            throw new ArgumentException("Invalid MQTT port or exact topic prefix.");
        if (!string.IsNullOrEmpty(Password) && string.IsNullOrWhiteSpace(Username))
            throw new ArgumentException("MQTT password requires a username.");
    }
}

public sealed class MqttReadSource : IReadOnlyTelemetrySource
{
    private readonly MqttReadOptions options;
    private readonly HashSet<string> optionalSubscriptions;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);
    public IReadOnlyList<string> Subscriptions { get; }

    public MqttReadSource(MqttReadOptions options)
    {
        options.Validate();
        this.options = options;
        optionalSubscriptions = Catalog.Metrics.Where(m => m.Optional || HeatingCurve.Fields.Any(f => f.Key == m.Key) || m.Key is "mainTargetTemperature" or "zonesState" || m.Suffix.StartsWith("extra/", StringComparison.Ordinal) || m.Key is "defrostState" or "threeWayValveState" or "zone1HeatRequest" or "zone1SensorMode" or "operationsHours" or "operationsCounter" or "waterPressure" or "dhwHeatDelta")
            .Select(m => options.Prefix + "/" + m.Suffix).ToHashSet(StringComparer.Ordinal);
        optionalSubscriptions.UnionWith([options.Prefix + "/1wire/+", options.Prefix + "/1wire/+/alias"]);
        Subscriptions = Catalog.Metrics.Select(m => options.Prefix + "/" + m.Suffix)
            .Append(options.Prefix + "/LWT").Append(options.Prefix + "/1wire/+")
            .Append(options.Prefix + "/1wire/+/alias").Distinct().ToArray();
    }

    public async Task RunAsync(TelemetryStore store, CancellationToken cancellationToken)
    {
        using var client = new MqttClientFactory().CreateMqttClient();
        client.ApplicationMessageReceivedAsync += e =>
        {
            var message = e.ApplicationMessage;
            if (!message.Topic.StartsWith(options.Prefix + "/", StringComparison.Ordinal)) return Task.CompletedTask;
            var suffix = message.Topic[(options.Prefix.Length + 1)..];
            var isAlias = suffix.EndsWith("/alias", StringComparison.Ordinal);
            if (!Subscriptions.Contains(message.Topic) && OneWire.FromSuffix(isAlias ? suffix[..^6] : suffix) is null) return Task.CompletedTask;
            try
            {
                if (isAlias && message.Payload.Length > 256) return Task.CompletedTask;
                var payload = message.Payload.Length > 256 ? "" : StrictUtf8.GetString(message.Payload);
                store.Receive(suffix, payload, message.Retain, message.Topic);
            }
            catch (DecoderFallbackException) { if (!isAlias) store.Receive(suffix, "", message.Retain, message.Topic); }
            return Task.CompletedTask;
        };
        client.DisconnectedAsync += _ => { store.SetConnection(false); return Task.CompletedTask; };
        var builder = new MqttClientOptionsBuilder().WithTcpServer(options.Host, options.Port)
            .WithClientId("cockpit-read-" + Guid.NewGuid().ToString("N"))
            .WithCleanSession().WithTimeout(TimeSpan.FromSeconds(5));
        if (!string.IsNullOrEmpty(options.Username)) builder.WithCredentials(options.Username, options.Password);
        // Use platform trust and hostname validation; never accept invalid certificates.
        if (options.UseTls == true) builder.WithTlsOptions(tls => tls.UseTls());
        var clientOptions = builder.Build();
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await client.ConnectAsync(clientOptions, cancellationToken);
                    store.SetConnection(true);
                    var subscription = new MqttClientSubscribeOptionsBuilder();
                    foreach (var topic in Subscriptions)
                        subscription.WithTopicFilter(f => f.WithTopic(topic).WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtMostOnce));
                    var result = await client.SubscribeAsync(subscription.Build(), cancellationToken);
                    if (result.Items.Any(i => (int)i.ResultCode >= 128 && !optionalSubscriptions.Contains(i.TopicFilter.Topic)))
                        throw new InvalidOperationException("MQTT subscription rejected.");
                    while (client.IsConnected) await Task.Delay(250, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
                catch (Exception)
                {
                    // Never log broker payloads, credentials or exception connection details.
                    store.SetConnection(false);
                    if (client.IsConnected)
                        await client.DisconnectAsync(new MqttClientDisconnectOptions(), CancellationToken.None);
                }
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
        finally { store.SetConnection(false); }
    }
}
