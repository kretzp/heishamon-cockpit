using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text;
using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using Cockpit.Infrastructure.Persistence;
using MQTTnet;
using MQTTnet.Protocol;
using MQTTnet.Server;
using Xunit;
namespace Cockpit.Integration;
public sealed class HeatingCurveMqttTests
{
    private sealed class Clock:TimeProvider { public DateTimeOffset Now=DateTimeOffset.UtcNow;public override DateTimeOffset GetUtcNow()=>Now; }
    [Fact] public void LiveActivationRequiresProfileCredentialsAndExpiry() {
        var read=new MqttReadOptions {LiveReadOnly=true,UseTls=false,Username="reader"};
        var options=new CurveControlOptions {Enabled=true,Username="writer",Password="isolated-fixture",ExpiresUtc=DateTimeOffset.UtcNow.AddMinutes(30)};
        Assert.Throws<ArgumentException>(()=>options.Validate(read,DateTimeOffset.UtcNow));
        (options with{ProfileConfirmed=true}).Validate(read,DateTimeOffset.UtcNow);
        Assert.Throws<ArgumentException>(()=>(options with{ProfileConfirmed=true,Username="reader"}).Validate(read,DateTimeOffset.UtcNow));
        Assert.Throws<ArgumentException>(()=>(options with{ProfileConfirmed=true,ExpiresUtc=null}).Validate(read,DateTimeOffset.UtcNow));
    }
    [Theory][InlineData(false)][InlineData(true)] public async Task IsolatedBrokerVerifiesThreeTopicsPayloadsNoRetainReadbackJournalAndNoReplay(bool continuous) {
        var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();var port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
        using var broker=new MqttServerFactory().CreateMqttServer(new MqttServerOptionsBuilder().WithDefaultEndpoint().WithDefaultEndpointPort(port).WithDefaultEndpointBoundIPAddress(IPAddress.Loopback).WithDefaultEndpointBoundIPV6Address(IPAddress.IPv6Loopback).Build());
        var messages=new ConcurrentQueue<MqttApplicationMessage>();var subscriptions=new ConcurrentQueue<string>();
        broker.InterceptingPublishAsync+=e=>{if(e.ClientId.StartsWith("cockpit-curve-write-"))messages.Enqueue(e.ApplicationMessage);return Task.CompletedTask;};
        broker.ClientSubscribedTopicAsync+=e=>{if(e.ClientId.StartsWith("cockpit-curve-write-"))subscriptions.Enqueue(e.TopicFilter.Topic);return Task.CompletedTask;};
        await broker.StartAsync();var clock=new Clock();var read=new MqttReadOptions {Port=port,IsolatedTestBroker=true,Username="reader"};
        var options=new CurveControlOptions {Enabled=true,Continuous=continuous,ScalarCommands=continuous,SterilizationEnabled=continuous,ExtendedControlsEnabled=continuous,Username="writer",Password="isolated-fixture",ExpiresUtc=continuous?null:clock.Now.AddMinutes(30)};
        using var writer=new MqttCurveTransport(read,options,clock);using var stop=new CancellationTokenSource(TimeSpan.FromSeconds(30));var running=writer.RunAsync(stop.Token);
        var folder=Path.Combine(Path.GetTempPath(),"cockpit-curve-"+Guid.NewGuid());Directory.CreateDirectory(folder);var path=Path.Combine(folder,"curve.db");
        var store=new TelemetryStore(SourceKind.Mqtt,new(360,10),clock);var readRunning=new MqttReadSource(read).RunAsync(store,stop.Token);
        async Task Inject(string suffix,string value)=>await broker.InjectApplicationMessage(new InjectedMqttApplicationMessage(new MqttApplicationMessageBuilder().WithTopic(read.Prefix+"/"+suffix).WithPayload(value).Build()));
        var original=new CurveValues(-10,35,15,25,5,18);var desired=original with{YCold=36,HeatDelta=6,HeatingOffTemperature=19};
        async Task Fresh(CurveValues v) {
            await Inject("LWT","Online");
            foreach(var (topic,value) in new[]{("main/Heating_Mode","0"),("main/Zones_State","0"),("main/Operating_Mode_State","4"),("main/Error","no error")})await Inject(topic,value);
            for(var i=0;i<HeatingCurve.Fields.Count;i++)await Inject(HeatingCurve.Fields[i].Topic,v.Numbers[i].ToString(System.Globalization.CultureInfo.InvariantCulture));
        }
        try {
            await Until(()=>writer.Connected&&store.Read().BrokerConnected);await Task.Delay(100);await Fresh(original);
            using(var journal=new SqliteCurveJournal(path,"mqtt")) {
                var service=new CurveService(store,"mqtt",journal,writer,options.ExpiresUtc,clock);await Until(()=>service.Context().Available);
                var r=service.Prepare("operator",new(Guid.NewGuid(),service.Context().ExpectedStateRevision,desired));service.Confirm("operator",r.Id);
                var observed=original;
                foreach(var part in new[]{"curve","delta","cutoff"}) {
                    await service.TickAsync();await Until(()=>messages.Count==(part=="curve"?1:part=="delta"?2:3));
                    Assert.Equal(CurveState.Running,service.Get(r.Id).State);clock.Now=clock.Now.AddSeconds(10);
                    observed=part switch{"curve"=>observed with{YCold=desired.YCold},"delta"=>observed with{HeatDelta=desired.HeatDelta},_=>desired};
                    await Fresh(observed);await Until(()=>HeatingCurve.Read(store.Read())==observed);await service.TickAsync();
                }
                Assert.Equal(CurveState.ObservedMatchingState,service.Get(r.Id).State);
                var epoch=writer.ConnectionEpoch;await broker.StopAsync();await Until(()=>!writer.Connected);await broker.StartAsync();await Until(()=>writer.Connected&&writer.ConnectionEpoch>epoch);Assert.Equal(3,messages.Count);
            }
            using(var journal=new SqliteCurveJournal(path,"mqtt")){var service=new CurveService(store,"mqtt",journal,writer,options.ExpiresUtc,clock);await service.TickAsync();Assert.Equal(CurveState.ObservedMatchingState,Assert.Single(service.List()).State);}
            Assert.Empty(subscriptions);Assert.Equal(new[]{"SetCurves","SetFloorHeatDelta","SetHeatingOffOutdoorTemp"},messages.Select(m=>m.Topic.Split('/').Last()));
            Assert.Equal(HeatingCurve.Payload("curve",desired),Encoding.UTF8.GetString(messages.First().Payload));Assert.Equal(new[]{"6","19"},messages.Skip(1).Select(m=>Encoding.UTF8.GetString(m.Payload)));
            Assert.All(messages,m=>{Assert.StartsWith("cockpit_test/commands/",m.Topic);Assert.False(m.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,m.QualityOfServiceLevel);});
            await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("SetDHWTemp",desired));
            await Assert.ThrowsAsync<CommandRejected>(()=>writer.SendAsync("curve",desired with{YCold=76}));Assert.Equal(3,messages.Count);
            if(continuous) {
                var scalar=(ICommandTransport)writer;
                await scalar.SendAsync("dhwTargetTemperature",55);
                await scalar.SendAsync("dhwHeatDelta",-8);
                await scalar.SendAsync("dhwTargetTemperature",52);
                await Until(()=>messages.Count==6);
                Assert.Equal(new[]{"SetDHWTemp","SetDHWHeatDelta","SetDHWTemp"},messages.Skip(3).Select(m=>m.Topic.Split('/').Last()));
                Assert.Equal(new[]{"55","-8","52"},messages.Skip(3).Select(m=>Encoding.UTF8.GetString(m.Payload)));
                Assert.All(messages,m=>{Assert.False(m.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,m.QualityOfServiceLevel);});
                foreach(var invalid in new[]{39d,61d,52.5,double.NaN})await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync("dhwTargetTemperature",invalid));
                await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync("heatpumpState",0));
                await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync("dhwHeatDelta",-1));
                Assert.Equal(6,messages.Count);
                await scalar.SendAsync("sterilizationState",1);await Until(()=>messages.Count==7);
                var start=messages.Last();Assert.EndsWith("/commands/SetForceSterilization",start.Topic);
                Assert.Equal("1",Encoding.UTF8.GetString(start.Payload));Assert.False(start.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,start.QualityOfServiceLevel);
                await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync("sterilizationState",0));
                foreach(var pair in new[]{("sterilizationTemperature",54d),("sterilizationTemperature",76d),("sterilizationTemperature",65.5d),("sterilizationMaxTime",4d),("sterilizationMaxTime",61d),("sterilizationMaxTime",6d),("sterilizationMaxTime",10.5d),("sterilizationTemperature",double.NaN),("sterilizationMaxTime",double.PositiveInfinity)})
                    await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync(pair.Item1,pair.Item2));
                Assert.Equal(7,messages.Count);
                await scalar.SendAsync("zone1HeatRequest",23); await scalar.SendAsync("quietMode",3); await scalar.SendAsync("operatingMode",6);
                await Until(()=>messages.Count==10);
                Assert.Equal(new[]{"SetZ1HeatRequestTemperature","SetQuietMode","SetOperationMode"},messages.Skip(7).Select(m=>m.Topic.Split('/').Last()));
                Assert.Equal(new[]{"23","3","6"},messages.Skip(7).Select(m=>Encoding.UTF8.GetString(m.Payload)));
                Assert.All(messages,m=>{Assert.False(m.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,m.QualityOfServiceLevel);});
                foreach(var pair in new[]{("zone1HeatRequest",15d),("quietMode",4d),("operatingMode",7d),("operatingMode",1.5d)}) await Assert.ThrowsAsync<CommandRejected>(()=>scalar.SendAsync(pair.Item1,pair.Item2));
                Assert.Equal(10,messages.Count);
                foreach(var pair in new[]{("sterilizationTemperature",55d),("sterilizationTemperature",75d),("sterilizationMaxTime",5d),("sterilizationMaxTime",60d)})
                    await scalar.SendAsync(pair.Item1,pair.Item2);
                await Until(()=>messages.Count==14);
                Assert.Equal(new[]{"SetSterilizationTemp","SetSterilizationTemp","SetSterilizationMaxTime","SetSterilizationMaxTime"},messages.Skip(10).Select(m=>m.Topic.Split('/').Last()));
                Assert.Equal(new[]{"55","75","5","60"},messages.Skip(10).Select(m=>Encoding.UTF8.GetString(m.Payload)));
                Assert.All(messages,m=>{Assert.StartsWith("cockpit_test/commands/",m.Topic);Assert.False(m.Retain);Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce,m.QualityOfServiceLevel);});
                await scalar.SendAsync("relayOne", 1);
                await scalar.SendAsync("relayTwo", 0);
                await Until(() => messages.Count == 16);
                Assert.Equal(new[] { "cockpit_test/gpio/relay/one", "cockpit_test/gpio/relay/two" }, messages.Skip(14).Select(m => m.Topic));
                Assert.Equal(new[] { "1", "0" }, messages.Skip(14).Select(m => Encoding.UTF8.GetString(m.Payload)));
                Assert.All(messages.Skip(14), m => { Assert.False(m.Retain); Assert.Equal(MqttQualityOfServiceLevel.AtMostOnce, m.QualityOfServiceLevel); });
                await Assert.ThrowsAsync<CommandRejected>(() => scalar.SendAsync("relayOne", 2));
                Assert.Equal(16, messages.Count);
            } else await Assert.ThrowsAsync<CommandRejected>(()=>((ICommandTransport)writer).SendAsync("dhwTargetTemperature",52));
            Assert.Throws<ArgumentException>(()=>new SqliteCurveJournal(path,"simulator"));
        } finally {await stop.CancelAsync();try{await Task.WhenAll(running,readRunning);}catch(OperationCanceledException){}await broker.StopAsync();Directory.Delete(folder,true);}
    }
    private static async Task Until(Func<bool> test){using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(10));while(!test())await Task.Delay(25,timeout.Token);}
}
