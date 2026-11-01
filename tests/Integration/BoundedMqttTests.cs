using System.Text;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using Cockpit.Infrastructure.Persistence;
using MQTTnet;
using MQTTnet.Protocol;
using MQTTnet.Server;
using Xunit;

namespace Cockpit.Integration;
public sealed class BoundedMqttTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    [Fact] public void RequiresSeparateCredentialsAndBoundedWindow()
    {
        var read = new MqttReadOptions { IsolatedTestBroker=true,Username="reader" };
        var options = new LiveTestOptions { Enabled=true,Username="writer",Password="isolated-fixture",ExpiresUtc=DateTimeOffset.UtcNow.AddMinutes(30) };
        Assert.Throws<ArgumentException>(() => (options with { Username="reader" }).Validate(read,DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => (options with { ExpiresUtc=null }).Validate(read,DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => (options with { ExpiresUtc=DateTimeOffset.UtcNow.AddHours(2) }).Validate(read,DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(() => options.Validate(read with { Host="192.0.2.1" },DateTimeOffset.UtcNow));
    }
    [Fact] public void SharedCredentialsRequireExplicitOperatorException()
    {
        var read=new MqttReadOptions { IsolatedTestBroker=true,Username="shared-fixture" };
        var options=new LiveTestOptions { Enabled=true,Username="shared-fixture",Password="isolated-fixture",ExpiresUtc=DateTimeOffset.UtcNow.AddMinutes(30) };
        Assert.Throws<ArgumentException>(()=>options.Validate(read,DateTimeOffset.UtcNow));
        (options with { AllowSharedCredentials=true }).Validate(read,DateTimeOffset.UtcNow);
        Assert.Throws<ArgumentException>(()=>(options with { AllowSharedCredentials=true,Password="" }).Validate(read,DateTimeOffset.UtcNow));
    }
    [Fact] public async Task ExpiredStagingWindowNeverStartsWriterConnection()
    {
        var read=new MqttReadOptions { IsolatedTestBroker=true,Username="reader" };
        var options=new LiveTestOptions { Enabled=true,Username="writer",Password="isolated-fixture",ExpiresUtc=DateTimeOffset.UtcNow.AddMinutes(-1) };
        using var writer=new MqttLiveTestTransport(read,options);
        await writer.RunAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(1));
        Assert.False(writer.Connected);
        Assert.Equal(0,writer.ConnectionEpoch);
        await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("dhwTargetTemperature",51));
        Assert.Equal(0,writer.ConnectionEpoch);
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task LocalBrokerReceivesOnlyTwoNonRetainedQosZeroMessagesAndNeverReplays(bool shared)
    {
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        using var broker=new MqttServerFactory().CreateMqttServer(new MqttServerOptionsBuilder().WithDefaultEndpoint().WithDefaultEndpointPort(port)
            .WithDefaultEndpointBoundIPAddress(IPAddress.Loopback).WithDefaultEndpointBoundIPV6Address(IPAddress.IPv6Loopback).Build());
        var messages=new ConcurrentQueue<MqttApplicationMessage>();var writerSubscriptions=new ConcurrentQueue<string>();
        broker.InterceptingPublishAsync += e => { if(e.ClientId.StartsWith("cockpit-bounded-write-"))messages.Enqueue(e.ApplicationMessage);return Task.CompletedTask; };
        broker.ClientSubscribedTopicAsync += e => { if(e.ClientId.StartsWith("cockpit-bounded-write-"))writerSubscriptions.Enqueue(e.TopicFilter.Topic);return Task.CompletedTask; };
        broker.ValidatingConnectionAsync += e => { if(e.ClientId.StartsWith("cockpit-bounded-write-") && (e.UserName != "writer" || e.Password != "isolated-fixture")) e.ReasonCode=MqttConnectReasonCode.BadUserNameOrPassword;return Task.CompletedTask; };
        await broker.StartAsync();
        var clock=new Clock();var read=new MqttReadOptions { Port=port,IsolatedTestBroker=true,Username=shared ? "writer" : "reader" };
        var options=new LiveTestOptions { Enabled=true,AllowSharedCredentials=shared,Username="writer",Password="isolated-fixture",ExpiresUtc=clock.Now.AddMinutes(30) };
        using var writer=new MqttLiveTestTransport(read,options,clock);
        using var stop=new CancellationTokenSource(TimeSpan.FromSeconds(30));var running=writer.RunAsync(stop.Token);
        var folder=Path.Combine(Path.GetTempPath(),"cockpit-bounded-"+Guid.NewGuid());Directory.CreateDirectory(folder);var path=Path.Combine(folder,"audit.db");
        try
        {
            await Until(()=>writer.Connected);
            await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("dhwHeatDelta",-8));
            await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("dhwTargetTemperature",53));
            var store=new TelemetryStore(SourceKind.Mqtt,new TelemetryPolicy(360,10),clock);store.SetConnection(true);store.Receive("LWT","Online");
            void Fresh(string target) { store.Receive("main/DHW_Target_Temp",target);store.Receive("main/DHW_Heat_Delta","-8");store.Receive("main/Operating_Mode_State","4");store.Receive("main/Error","no error"); }
            Fresh("52");var policy=new CommandPolicy(true,options.ExpiresUtc);
            using(var journal=new SqliteCommandJournal(path,"mqtt"))
            {
                var service=new CommandService(store,journal,writer,policy,clock);
                CommandRecord Prepare(double value)=>service.Prepare("operator",new(Guid.NewGuid(),"setDhwTemperature",value,service.Context("setDhwTemperature").ExpectedStateRevision));
                var draft=Prepare(51);
                await Task.WhenAll(service.ConfirmAsync("operator",draft.Id),service.ConfirmAsync("operator",draft.Id));
                await Until(()=>messages.Count==1);
                clock.Now=clock.Now.AddSeconds(30);Fresh("51");service.Tick();Assert.Equal(CommandState.ObservedMatchingState,service.Get(draft.Id).State);
                var epoch=writer.ConnectionEpoch;await broker.StopAsync();await Until(()=>!writer.Connected);await broker.StartAsync();await Until(()=>writer.Connected && writer.ConnectionEpoch>epoch);
                Assert.Single(messages); // Reconnect must not replay a publish.
                draft=Prepare(52);await service.ConfirmAsync("operator",draft.Id);await Until(()=>messages.Count==2);
                clock.Now=clock.Now.AddSeconds(30);Fresh("52");service.Tick();Assert.Equal(CommandState.ObservedMatchingState,service.Get(draft.Id).State);
                Assert.Equal(0,service.Context("setDhwTemperature").RemainingSends);
                await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("dhwTargetTemperature",51));
            }
            using(var journal=new SqliteCommandJournal(path,"mqtt"))
            {
                var restarted=new CommandService(store,journal,writer,policy,clock);
                Assert.Equal(0,restarted.Context("setDhwTemperature").RemainingSends);
                Assert.False(restarted.Context("setDhwTemperature").Available);
            }
            var restoredPath=Path.Combine(folder,"restored.db");
            using(var origin=new Microsoft.Data.Sqlite.SqliteConnection(new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder { DataSource=path,Pooling=false }.ToString()))
            using(var restored=new Microsoft.Data.Sqlite.SqliteConnection(new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder { DataSource=restoredPath,Pooling=false }.ToString()))
            { origin.Open();restored.Open();origin.BackupDatabase(restored); }
            using(var journal=new SqliteCommandJournal(restoredPath,"mqtt"))
            {
                var restored=new CommandService(store,journal,writer,policy,clock);
                Assert.Equal(0,restored.Context("setDhwTemperature").RemainingSends);
                Assert.False(restored.Context("setDhwTemperature").Available);
                Assert.Equal(2,restored.List().Count);
            }
            Assert.Equal(2,messages.Count);
            Assert.Throws<ArgumentException>(()=>new SqliteCommandJournal(path,"simulator"));
            Assert.Equal(new[]{"51","52"},messages.Select(m=>System.Text.Encoding.UTF8.GetString(m.Payload)));
            Assert.All(messages,m=>{Assert.Equal("cockpit_test/commands/SetDHWTemp",m.Topic);Assert.False(m.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,m.QualityOfServiceLevel);});
            Assert.Empty(writerSubscriptions);
            clock.Now=clock.Now.AddHours(1);await Until(()=>!writer.Connected);
            await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("dhwTargetTemperature",52));Assert.Equal(2,messages.Count);
        }
        finally { await stop.CancelAsync();try { await running; }catch(OperationCanceledException){}await broker.StopAsync();Directory.Delete(folder,true); }
    }
    private static async Task Until(Func<bool> test)
    {
        using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while(!test())await Task.Delay(25,timeout.Token);
    }
}
