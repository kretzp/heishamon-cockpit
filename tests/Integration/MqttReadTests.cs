using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using MQTTnet;
using MQTTnet.Server;
using Xunit;

namespace Cockpit.Integration;

public sealed class MqttReadTests
{
    [Theory]
    [InlineData("192.0.2.1", "test", true)]
    [InlineData("localhost", "test", true)]
    [InlineData("127.0.0.1", "test/#", true)]
    [InlineData("127.0.0.1", "test", false)]
    public void RejectsNonIsolatedConfiguration(string host, string prefix, bool isolated)
        => Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { Host = host, Prefix = prefix, IsolatedTestBroker = isolated }));

    [Theory]
    [InlineData("broker.example", "panasonic_heat_pump", true)]
    [InlineData("192.0.2.1", "home/heatpump", false)]
    public void AcceptsExplicitLiveReadOnlyConfigurationWithoutConnecting(string host, string prefix, bool tls)
    {
        var source = new MqttReadSource(new() { Host = host, Prefix = prefix, Port = 1883, LiveReadOnly = true, UseTls = tls });
        Assert.Equal(44, source.Subscriptions.Count);
        Assert.All(source.Subscriptions, topic => Assert.StartsWith(prefix + "/", topic));
    }

    [Fact]
    public void RejectsAmbiguousLiveConfiguration()
    {
        Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { LiveReadOnly = true }));
        Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { LiveReadOnly = true, IsolatedTestBroker = true, UseTls = true }));
        Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { LiveReadOnly = true, UseTls = true, Host = "mqtt://broker" }));
        Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { LiveReadOnly = true, UseTls = false, Prefix = "home/+" }));
        Assert.Throws<ArgumentException>(() => new MqttReadSource(new() { LiveReadOnly = true, UseTls = false, Password = "fixture" }));
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task LocalBrokerExercisesSubscriptionsRetainedLwtReconnectAndNoPublishes(bool live, bool rejectExtra)
    {
        // Reserve an OS-selected loopback port; the server also explicitly binds both stacks to loopback.
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        var options = new MqttServerOptionsBuilder().WithDefaultEndpoint().WithDefaultEndpointPort(port)
            .WithDefaultEndpointBoundIPAddress(IPAddress.Loopback)
            .WithDefaultEndpointBoundIPV6Address(IPAddress.IPv6Loopback).Build();
        using var broker = new MqttServerFactory().CreateMqttServer(options);
        var subscriptions = new ConcurrentBag<string>();
        var clientPublishes = new ConcurrentBag<string>();
        broker.ClientSubscribedTopicAsync += e => { subscriptions.Add(e.TopicFilter.Topic); return Task.CompletedTask; };
        broker.InterceptingPublishAsync += e =>
        {
            if (e.ClientId.StartsWith("cockpit-read-", StringComparison.Ordinal)) clientPublishes.Add(e.ApplicationMessage.Topic);
            return Task.CompletedTask;
        };
        broker.InterceptingSubscriptionAsync += e =>
        {
            if (rejectExtra && e.TopicFilter.Topic.Contains("/extra/", StringComparison.Ordinal))
                e.Response.ReasonCode = MQTTnet.Protocol.MqttSubscribeReasonCode.NotAuthorized;
            return Task.CompletedTask;
        };
        await broker.StartAsync();
        async Task Inject(string suffix, string payload, bool retain = false)
            => await broker.InjectApplicationMessage(new InjectedMqttApplicationMessage(
                new MqttApplicationMessageBuilder().WithTopic("cockpit_test/" + suffix).WithPayload(payload).WithRetainFlag(retain).Build())
                { SenderClientId = "isolated-fixture" });

        await Inject("main/Main_Outlet_Temp", "34.5", true);
        await Inject("LWT", "Online", true);
        var source = new MqttReadSource(new() { Port = port, IsolatedTestBroker = !live, LiveReadOnly = live, UseTls = false });
        var expectedSubscriptions = source.Subscriptions.Where(t => !rejectExtra || !t.Contains("/extra/", StringComparison.Ordinal)).ToArray();
        var store = new TelemetryStore(SourceKind.Mqtt);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var running = source.RunAsync(store, cancellation.Token);
        TelemetryValue Flow() => store.Read().Values.Single(v => v.Key == "flowTemperature");
        try
        {
            await Until(() => subscriptions.Count >= expectedSubscriptions.Length && Flow().Retained);
            Assert.Equal(expectedSubscriptions.Order(), subscriptions.Order());
            Assert.DoesNotContain(subscriptions, t => t.Contains('#') || t.Contains('+') || t.Contains("commands"));
            Assert.Equal(Quality.Stale, Flow().Quality);
            Assert.Equal(Availability.Unknown, store.Read().DeviceAvailability);
            await Inject("LWT", "Online");
            await Inject("main/Room_Thermostat_Temp", "22.5");
            await Until(() => store.Read().Values.Single(v => v.Key == "indoorTemperature").Quality == Quality.Valid);
            Assert.Equal(22.5, store.Read().Values.Single(v => v.Key == "indoorTemperature").Value);
            await Inject("main/Z1_Sensor_Settings", "2");
            await Inject("main/Z1_Heat_Request_Temp", "22");
            await Until(() => store.Read().Values.Single(v => v.Key == "indoorTargetTemperature").Quality == Quality.Valid);
            Assert.Equal(22d, store.Read().Values.Single(v => v.Key == "indoorTargetTemperature").Value);
            foreach (var (suffix, key, payload, expected) in new[] {
                ("Operations_Hours", "operationsHours", "12345", 12345d),
                ("Operations_Counter", "operationsCounter", "2345", 2345d),
                ("Water_Pressure", "waterPressure", "1.6", 1.6d),
                ("DHW_Heat_Delta", "dhwHeatDelta", "-6", -6d),
                ("Pump_Speed", "pumpSpeed", "1750", 1750d),
                ("Fan1_Motor_Speed", "fanSpeed", "0", 0d),
                ("Compressor_Current", "compressorCurrent", "4.44", 4.44d),
                ("High_Pressure", "highPressure", "10.24", 10.24d) })
            {
                await Inject("main/" + suffix, payload);
                await Until(() => store.Read().Values.Single(v => v.Key == key).Quality == Quality.Valid);
                Assert.Equal(expected, store.Read().Values.Single(v => v.Key == key).Value);
            }
            await Inject("main/ThreeWay_Valve_State", "1");
            await Until(() => Equals(store.Read().Values.Single(v => v.Key == "threeWayValveState").Value, 1));
            await Inject("main/Error", "NO ERROR");
            await Until(() => Equals(store.Read().Values.Single(v => v.Key == "activeError").Value, "no error"));
            Assert.Equal(Quality.Valid, store.Read().Values.Single(v => v.Key == "activeError").Quality);
            await Inject("main/Pump_Flow", "15.89");
            await Until(() => Equals(store.Read().Values.Single(v => v.Key == "waterFlow").Value, 15.89d));
            Assert.DoesNotContain(store.Read().Diagnostics, d => d.Key == "waterFlow");
            await Inject("main/Main_Outlet_Temp", "35.25");
            await Until(() => Flow().Quality == Quality.Valid);
            Assert.Equal(35.25, Flow().Value);
            Assert.Equal("cockpit_test/main/Main_Outlet_Temp", Flow().SourceTopic);
            await Inject("main/Main_Outlet_Temp", "NaN");
            await Until(() => Flow().Quality == Quality.Invalid);
            Assert.Null(Flow().Value);
            await Inject("LWT", "Offline");
            await Until(() => store.Read().DeviceAvailability == Availability.Offline);
            Assert.True(store.Read().BrokerConnected);
            await broker.StopAsync();
            await Until(() => !store.Read().BrokerConnected);
            await broker.StartAsync();
            await Until(() => subscriptions.Count >= expectedSubscriptions.Length * 2 && store.Read().BrokerConnected);
            Assert.NotEqual(Quality.Valid, Flow().Quality);
            await Inject("LWT", "Online");
            await Inject("main/Main_Outlet_Temp", "36");
            await Until(() => Flow().Quality == Quality.Valid);
            Assert.Equal(36d, Flow().Value);
            Assert.Empty(clientPublishes);
        }
        finally
        {
            await cancellation.CancelAsync();
            try { await running; } catch (OperationCanceledException) { }
            await broker.StopAsync();
        }
    }

    private static async Task Until(Func<bool> predicate)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (!predicate()) await Task.Delay(25, timeout.Token);
    }
}
