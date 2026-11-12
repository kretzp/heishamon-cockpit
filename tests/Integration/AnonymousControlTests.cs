using Cockpit.Domain;
using Cockpit.Infrastructure;
using Xunit;
using System.Net;
using System.Net.Sockets;
using MQTTnet;
using MQTTnet.Server;

namespace Cockpit.Integration;

public sealed class AnonymousControlTests
{
    [Theory]
    [InlineData("y\ny\ny\n", true)]
    [InlineData("yes\nyes\nyes\n", true)]
    [InlineData("n\n", false)]
    [InlineData("no\n", false)]
    [InlineData("\n", false)]
    [InlineData("y\nn\n", false)]
    [InlineData("y\ny\nn\n", false)]
    public void AnonymousControlRequiresRiskAndDeviceConsent(string answers, bool expected)
    {
        using var input = new StringReader(answers);
        using var output = new StringWriter();
        Assert.Equal(expected, InstallationSetup.ReadControlConsent(true, input, output));
        Assert.Contains("Do you accept these security risks and enable heat-pump control at your own risk?", output.ToString());
    }

    [Theory]
    [InlineData("y\ny\ny\ny\n", true)]
    [InlineData("y\ny\ny\nn\n", false)]
    [InlineData("n\n", false)]
    public void AuthenticatedControlStillRequiresCredentialAuthorization(string answers, bool expected)
    {
        using var input = new StringReader(answers);
        using var output = new StringWriter();
        Assert.Equal(expected, InstallationSetup.ReadControlConsent(false, input, output));
        Assert.DoesNotContain("at your own risk", output.ToString());
    }

    [Fact]
    public void EndOfInputDoesNotAcceptAnonymousRisk()
    {
        using var input = new StringReader("");
        using var output = new StringWriter();
        Assert.Throws<EndOfStreamException>(() => InstallationSetup.ReadControlConsent(true, input, output));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void StoreRequiresExplicitAnonymousConsentAndPersistsIt(bool consent)
    {
        var root = Path.Combine(Path.GetTempPath(), "anonymous-control-" + Guid.NewGuid().ToString("N"));
        try
        {
            var path = Path.Combine(root, "control.json");
            var store = new ControlSetupStore(path);
            var read = new MqttReadOptions { Host = "192.0.2.10", UseTls = false };
            var input = new ControlSetupInput(true, HeatingCurve.Profile, true, true, true, 0, consent);
            if (!consent) { Assert.Throws<CommandRejected>(() => store.Save(input, "mqtt", read, false)); return; }
            store.Save(input, "mqtt", read, false);
            Assert.True(new ControlSetupStore(path).Read().AnonymousControlAccepted);
            var disabled = store.Save(new(false, null, false, false, false, 1), "mqtt", read, false);
            Assert.False(disabled.AnonymousControlAccepted);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    [Fact]
    public void RuntimeAnonymousExceptionRequiresContinuousModeAndExplicitConsent()
    {
        var read = new MqttReadOptions { Host = "192.0.2.10", UseTls = false, LiveReadOnly = true };
        var options = new CurveControlOptions { Enabled = true, Continuous = true, ProfileConfirmed = true };
        Assert.Throws<ArgumentException>(() => options.Validate(read, DateTimeOffset.UtcNow));
        (options with { AllowAnonymousControl = true }).Validate(read, DateTimeOffset.UtcNow);
        Assert.Throws<ArgumentException>(() => (options with { AllowAnonymousControl = true, Continuous = false, ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(5) }).Validate(read, DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => (options with { AllowAnonymousControl = true, Username = "incomplete" }).Validate(read, DateTimeOffset.UtcNow));
        using var transport = new MqttCurveTransport(read, options with { AllowAnonymousControl = true, ConnectionEnabled = false });
        Assert.False(transport.Connected);
    }

    [Fact]
    public async Task ConsentedAnonymousWriterCanPublishToIsolatedLoopbackBroker()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        using var broker = new MqttServerFactory().CreateMqttServer(new MqttServerOptionsBuilder()
            .WithDefaultEndpoint().WithDefaultEndpointPort(port)
            .WithDefaultEndpointBoundIPAddress(IPAddress.Loopback).WithDefaultEndpointBoundIPV6Address(IPAddress.IPv6Loopback).Build());
        var published = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        broker.InterceptingPublishAsync += args => { published.TrySetResult(args.ApplicationMessage.Topic); return Task.CompletedTask; };
        await broker.StartAsync();
        var read = new MqttReadOptions { Port = port, IsolatedTestBroker = true };
        using var writer = new MqttCurveTransport(read, new CurveControlOptions { Enabled = true, Continuous = true, AllowAnonymousControl = true });
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var running = writer.RunAsync(stop.Token);
        try
        {
            while (!writer.Connected) await Task.Delay(25, stop.Token);
            await writer.SendAsync("delta", new CurveValues(-10, 35, 15, 25, 5, 18));
            Assert.StartsWith("cockpit_test/commands/", await published.Task.WaitAsync(stop.Token));
        }
        finally
        {
            stop.Cancel();
            try { await running; } catch (OperationCanceledException) { }
            await broker.StopAsync();
        }
    }
}
