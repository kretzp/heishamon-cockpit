using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;
namespace Cockpit.Unit;
public sealed class HeatingCurveTests
{
    private static readonly CurveValues Example=new(-10,35,15,25,5,18);
    [Theory][InlineData(-30,35)][InlineData(-10,35)][InlineData(6,28.6)][InlineData(15,25)][InlineData(40,25)]
    public void InterpolationAndClamping(double outside,double expected)=>Assert.Equal(expected,HeatingCurve.Calculate(Example,outside),8);
    [Fact] public void SlopeAndPayloadPreserveAxisMeaning() {
        Assert.Equal(-.4,HeatingCurve.Slope(Example),8);
        Assert.Equal("{\"zone1\":{\"heat\":{\"target\":{\"high\":35,\"low\":25},\"outside\":{\"low\":-10,\"high\":15}}}}",HeatingCurve.Payload("curve",Example));
        Assert.Equal("5",HeatingCurve.Payload("delta",Example));Assert.Equal("18",HeatingCurve.Payload("cutoff",Example));
        Assert.Throws<CommandRejected>(()=>HeatingCurve.Payload("zone2",Example));
    }
    [Theory][InlineData(-20,15,20,20,1,5)][InlineData(-20,15,75,75,15,35)]
    public void ModelLimitsAccepted(double xc,double xw,double yc,double yw,double delta,double cutoff)=>Assert.Empty(HeatingCurve.Validate(new(xc,yc,xw,yw,delta,cutoff)));
    [Theory][InlineData("xCold",-21)][InlineData("xCold",15)][InlineData("xWarm",16)][InlineData("xWarm",-10)][InlineData("yCold",19)][InlineData("yCold",76)][InlineData("yWarm",36)][InlineData("heatDelta",0)][InlineData("heatDelta",16)][InlineData("heatingOffTemperature",4)][InlineData("heatingOffTemperature",36)][InlineData("yCold",35.5)][InlineData("yCold",double.NaN)]
    public void RejectInvalid(string property,double number) {
        var v=Example;v=property switch {"xCold"=>v with{XCold=number},"xWarm"=>v with{XWarm=number},"yCold"=>v with{YCold=number},"yWarm"=>v with{YWarm=number},"heatDelta"=>v with{HeatDelta=number},_=>v with{HeatingOffTemperature=number}};
        Assert.NotEmpty(HeatingCurve.Validate(v));Assert.Throws<CommandRejected>(()=>HeatingCurve.Payload("curve",v));
    }
    private sealed class Journal:ICurveJournal {
        public List<CurveRecord> Audit=[];public bool Fail;
        public IReadOnlyList<CurveRecord> Read()=>Audit.GroupBy(r=>r.Id).Select(g=>g.Last()).ToArray();
        public void Save(CurveRecord r){if(Fail)throw new IOException();Audit.Add(r);}
    }
    private sealed class Transport:ICurveTransport {
        public bool Connected{get;set;}=true;public long ConnectionEpoch{get;set;}
        public List<string> Sends=[];public bool Fail;
        public Task SendAsync(string part,CurveValues v){Sends.Add(part);if(Fail)throw new IOException();return Task.CompletedTask;}
    }
    private readonly TestClock clock=new();
    private readonly Journal journal=new();
    private readonly Transport transport=new();
    private readonly TelemetryStore store;
    private readonly CurveService service;
    public HeatingCurveTests(){store=new(SourceKind.Simulator,clock:clock);SimulatorSource.Apply(store,"no-error");service=new(store,"simulator",journal,transport,clock:clock);}
    private CurveRequest Request(CurveValues? v=null)=>new(Guid.NewGuid(),service.Context().ExpectedStateRevision,v??Example with{YCold=36,HeatDelta=6,HeatingOffTemperature=19});
    private CurveRecord Start(CurveValues? v=null){var r=service.Prepare("operator",Request(v));return service.Confirm("operator",r.Id);}
    private void Receive(string part,CurveValues v,bool retained=false){for(var i=0;i<HeatingCurve.Fields.Count;i++)if(HeatingCurve.Fields[i].Part==part)store.Receive(HeatingCurve.Fields[i].Topic,v.Numbers[i].ToString(System.Globalization.CultureInfo.InvariantCulture),retained);}
    [Fact] public async Task SerialThreePartWorkflowWithFreshReadbackAndNoResend() {
        var request=Request();var r=service.Prepare("operator",request);Assert.Empty(transport.Sends);Assert.Equal(r,service.Prepare("operator",request));
        Assert.Throws<CommandRejected>(()=>service.Confirm("other",r.Id));service.Confirm("operator",r.Id);service.Confirm("operator",r.Id);
        foreach(var part in new[]{"curve","delta","cutoff"}) {
            await service.TickAsync();Assert.Equal(part,transport.Sends.Last());
            Receive(part,r.Desired);await service.TickAsync();Assert.Equal(CurveState.Running,service.Get(r.Id).State);
            clock.Advance(10);Receive(part,r.Desired);await service.TickAsync();
        }
        Assert.Equal(CurveState.ObservedMatchingState,service.Get(r.Id).State);Assert.Equal(3,transport.Sends.Count);
        service.Confirm("operator",r.Id);await service.TickAsync();Assert.Equal(3,transport.Sends.Count);
        Assert.All(service.Get(r.Id).Parts,p=>Assert.Equal(CurvePartState.ObservedMatchingState,p.State));
    }
    [Fact] public async Task OnlyChangedGroupSent() {
        var r=Start(Example with{HeatingOffTemperature=20});await service.TickAsync();Assert.Equal(new[]{"cutoff"},transport.Sends);Assert.Single(r.Parts);
        clock.Advance(10);Receive("cutoff",r.Desired);await service.TickAsync();Assert.Equal(CurveState.ObservedMatchingState,service.Get(r.Id).State);
    }
    [Fact] public async Task PartialTimeoutSkipsLaterGroupAndNeverRollsBack() {
        var r=Start();await service.TickAsync();clock.Advance(10);Receive("curve",r.Desired);await service.TickAsync();await service.TickAsync();
        clock.Advance(20);await service.TickAsync();r=service.Get(r.Id);Assert.Equal(CurveState.Partial,r.State);Assert.Equal(CurvePartState.TimedOut,r.Parts[1].State);Assert.Equal(CurvePartState.Skipped,r.Parts[2].State);
        await service.TickAsync();Assert.Equal(new[]{"curve","delta"},transport.Sends);
    }
    [Fact] public async Task TransportFailureStopsSequenceAndKeepsIntent() {
        var r=Start();transport.Fail=true;await service.TickAsync();r=service.Get(r.Id);Assert.Equal(CurveState.Failed,r.State);Assert.Equal("delivery_unknown",r.Reason);Assert.NotNull(r.Parts[0].SentUtc);Assert.Single(transport.Sends);
    }
    [Fact] public async Task MismatchTimesOutAndOldMatchingMessageDoesNotCount() {
        var r=Start();await service.TickAsync();Receive("curve",r.Desired);clock.Advance(20);await service.TickAsync();Assert.Equal(CurveState.TimedOut,service.Get(r.Id).State);Assert.Single(transport.Sends);
    }
    [Fact] public async Task ExternalChangeInUnsentPartAborts() {
        var r=Start();await service.TickAsync();Receive("cutoff",Example with{HeatingOffTemperature=30});await service.TickAsync();Assert.Equal("state_conflict",service.Get(r.Id).Reason);Assert.Single(transport.Sends);
    }
    [Fact] public async Task ChangeToPreviouslyMatchedPartAbortsRemaining() {
        var r=Start();await service.TickAsync();clock.Advance(10);Receive("curve",r.Desired);await service.TickAsync();Receive("curve",Example);await service.TickAsync();Assert.Equal(CurveState.Partial,service.Get(r.Id).State);Assert.Single(transport.Sends);
    }
    [Fact] public void ChangedRevisionAndIdempotencyConflictRejected() {
        var request=Request();var r=service.Prepare("operator",request);
        Assert.Throws<CommandRejected>(()=>service.Prepare("operator",request with{Desired=Example}));
        Receive("cutoff",Example with{HeatingOffTemperature=20});Assert.Equal("state_conflict",Assert.Throws<CommandRejected>(()=>service.Confirm("operator",r.Id)).Code);Assert.Empty(transport.Sends);
    }
    [Theory][InlineData("main/Heating_Mode","1")][InlineData("main/Zones_State","1")][InlineData("main/Operating_Mode_State","3")][InlineData("main/Error","H76")][InlineData("main/Heat_Delta","?")]
    public void InvalidCapabilityOrQualityBlocks(string topic,string payload){store.Receive(topic,payload);Assert.False(service.Context().Available);Assert.Throws<CommandRejected>(()=>Start());}
    [Fact] public void RetainedStaleOfflineReadOnlyAndExpiredBlock() {
        Receive("curve",Example,true);Assert.False(service.Context().Available);SimulatorSource.Apply(store,"no-error");clock.Advance(121);Assert.False(service.Context().Available);
        SimulatorSource.Apply(store,"no-error");store.SetConnection(false);Assert.False(service.Context().Available);
        SimulatorSource.Apply(store,"no-error");Assert.False(new CurveService(store,"simulator").Context().Available);
        Assert.False(new CurveService(store,"simulator",journal,transport,clock.GetUtcNow().AddSeconds(-1),clock).Context().Available);
    }
    [Fact] public async Task AuditFailureBeforeSendFailsClosed() {
        Start();journal.Fail=true;await Assert.ThrowsAsync<CommandRejected>(()=>service.TickAsync());Assert.Empty(transport.Sends);journal.Fail=false;await service.TickAsync();Assert.Empty(transport.Sends);Assert.False(service.Context().Available);
    }
    [Fact] public async Task RestartAndReconnectDoNotReplay() {
        var r=Start();await service.TickAsync();var restarted=new CurveService(store,"simulator",journal,transport,clock:clock);await restarted.TickAsync();Assert.Equal(CurveState.Cancelled,restarted.Get(r.Id).State);Assert.Equal(CurvePartState.Cancelled,restarted.Get(r.Id).Parts[0].State);Assert.Single(transport.Sends);
    }
    [Fact] public async Task WriterEpochChangeCancels() {var r=Start();transport.ConnectionEpoch++;await service.TickAsync();Assert.Equal(CurveState.Cancelled,service.Get(r.Id).State);Assert.Empty(transport.Sends);}
    [Fact] public async Task CancellationAndExpiredDraftNeverSend() {
        var r=service.Prepare("operator",Request());service.Cancel("operator",r.Id);await service.TickAsync();Assert.Empty(transport.Sends);
        r=service.Prepare("operator",Request());clock.Advance(60);Assert.Equal(CurveState.Cancelled,service.Confirm("operator",r.Id).State);await service.TickAsync();Assert.Empty(transport.Sends);
    }
    [Theory][InlineData("main/Heat_Delta","16")][InlineData("main/Heating_Off_Outdoor_Temp","4")][InlineData("main/Z1_Heat_Curve_Target_High_Temp","35.5")]
    public void InvalidSettingsNeverBecomeUsableTelemetry(string topic,string value) {
        store.Receive(topic,value);var field=HeatingCurve.Fields.Single(f=>f.Topic==topic);var observed=store.Read().Values.Single(v=>v.Key==field.Key);
        Assert.Null(observed.Value);Assert.Equal(Quality.Invalid,observed.Quality);Assert.False(service.Context().Available);
    }
    [Fact] public void UnchangedValuesRejectedAndMappingCorrect() {
        Assert.Equal(Example,service.Context().Current);Assert.Equal("unchanged",Assert.Throws<CommandRejected>(()=>service.Prepare("operator",Request(Example))).Code);
        Assert.Equal("main/Z1_Heat_Curve_Target_High_Temp",HeatingCurve.Fields.Single(f=>f.Property=="yCold").Topic);
    }
}
