using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;
namespace Cockpit.Unit;

public sealed class CombinedControlTests
{
    private sealed class ScalarJournal : ICommandJournal {
        public List<CommandRecord> Rows=[]; public bool Fail;
        public IReadOnlyList<CommandRecord> Read()=>Rows.GroupBy(r=>r.Id).Select(g=>g.Last()).ToArray();
        public void Save(CommandRecord r) { if(Fail)throw new IOException(); Rows.Add(r); }
    }
    private sealed class CurveJournal : ICurveJournal {
        public List<CurveRecord> Rows=[]; public bool Fail;
        public IReadOnlyList<CurveRecord> Read()=>Rows.GroupBy(r=>r.Id).Select(g=>g.Last()).ToArray();
        public void Save(CurveRecord r) { if(Fail)throw new IOException(); Rows.Add(r); }
    }
    private sealed class Writer : ICommandTransport, ICurveTransport {
        public bool Connected=>true; public long ConnectionEpoch=>0; public int Sends;
        public Task SendAsync(string key,double value) { Sends++;return Task.CompletedTask; }
        public Task SendAsync(string key,CurveValues value) { Sends++;return Task.CompletedTask; }
    }
    private readonly TelemetryStore store;
    private readonly TestClock clock=new();
    private readonly CommandCoordinator coordinator=new();
    private readonly ScalarJournal scalarJournal=new();
    private readonly CurveJournal curveJournal=new();
    private readonly Writer writer=new();
    private readonly CommandService scalar;
    private readonly CurveService curve;
    public CombinedControlTests() {
        store=new(SourceKind.Mqtt,new(360,10),clock);SimulatorSource.Apply(store,"no-error");
        scalar=new(store,scalarJournal,writer,new(ContinuousMqtt:true, SterilizationEnabled:true),clock,coordinator);
        curve=new(store,"mqtt",curveJournal,writer,clock:clock,coordinator:coordinator);
    }
    private CommandRecord Scalar()=>scalar.Prepare("operator",new(Guid.NewGuid(),"setDhwHeatDelta",-8,scalar.Context("setDhwHeatDelta").ExpectedStateRevision));
    private CurveRecord Curve()=>curve.Prepare("operator",new(Guid.NewGuid(),curve.Context().ExpectedStateRevision,curve.Context().Current! with{HeatingOffTemperature=19}));
    [Fact] public void DraftReservationBlocksOtherAreaAndCancellationReleasesIt() {
        var r=Scalar();Assert.False(curve.Context().Available);Assert.Throws<CommandRejected>(()=>Curve());
        scalar.Cancel("operator",r.Id);var c=Curve();Assert.False(scalar.Context("setDhwHeatDelta").Available);
        Assert.Throws<CommandRejected>(()=>Scalar());curve.Cancel("operator",c.Id);Assert.True(scalar.Context("setDhwHeatDelta").Available);Assert.Equal(0,writer.Sends);
    }
    [Fact] public async Task ReservationLastsThroughReadbackAndTimeout() {
        var r=Scalar();await scalar.ConfirmAsync("operator",r.Id);Assert.False(curve.Context().Available);
        clock.Advance(10);store.Receive("main/DHW_Heat_Delta","-8");scalar.Tick();
        Assert.Equal(CommandState.ObservedMatchingState,scalar.Get(r.Id).State);Assert.True(curve.Context().Available);
        var c=Curve();curve.Confirm("operator",c.Id);await curve.TickAsync();Assert.False(scalar.Context("setDhwHeatDelta").Available);
        clock.Advance(360);SimulatorSource.Apply(store,"no-error");await curve.TickAsync();
        Assert.NotEqual(CurveState.Running,curve.Get(c.Id).State);Assert.True(scalar.Context("setDhwHeatDelta").Available);
    }
    [Theory][InlineData(true)][InlineData(false)] public void EitherAuditFailureBlocksBothAreas(bool failScalar) {
        if(failScalar){scalarJournal.Fail=true;Assert.Throws<CommandRejected>(()=>Scalar());}
        else{curveJournal.Fail=true;Assert.Throws<CommandRejected>(()=>Curve());}
        Assert.False(curve.Context().Available);Assert.False(scalar.Context("setDhwHeatDelta").Available);Assert.Equal(0,writer.Sends);
    }
    [Fact] public async Task PermanentScalarSupportsBothParametersBeyondTwoAttemptsWithoutReplay() {
        for(int i=0;i<3;i++) {
            SimulatorSource.Apply(store,"no-error");
            var r=Scalar();await scalar.ConfirmAsync("operator",r.Id);await scalar.ConfirmAsync("operator",r.Id);
            clock.Advance(10);store.Receive("main/DHW_Heat_Delta","-8");scalar.Tick();Assert.Equal(CommandState.ObservedMatchingState,scalar.Get(r.Id).State);
            clock.Advance(30);
        }
        Assert.Equal(3,writer.Sends);Assert.Null(scalar.Context("setDhwTemperature").RemainingSends);
        Assert.Equal(360,scalar.Context("setDhwTemperature").TimeoutSeconds);
        Assert.Equal(40,scalar.Context("setDhwTemperature").Minimum);Assert.Equal(60,scalar.Context("setDhwTemperature").Maximum);
        Assert.Throws<CommandRejected>(()=>scalar.Context("setHeatpump"));
        SimulatorSource.Apply(store,"no-error");var pending=Scalar();var restarted=new CommandService(store,scalarJournal,writer,new(ContinuousMqtt:true, SterilizationEnabled:true),clock,new());
        Assert.Equal(CommandState.Cancelled,restarted.Get(pending.Id).State);Assert.Equal(3,writer.Sends);
    }
    private CommandRecord Sterilize()=>scalar.Prepare("operator",new(Guid.NewGuid(),"startSterilization",1,scalar.Context("startSterilization").ExpectedStateRevision));
    [Theory]
    [InlineData("setSterilizationTemperature", "main/Sterilization_Temp", 55, 75)]
    [InlineData("setSterilizationMaxTime", "main/Sterilization_Max_Time", 5, 60)]
    public async Task SterilizationSettingsValidateBoundsAndObserveOnlyFreshReadback(string type, string topic, int minimum, int maximum) {
        var context=scalar.Context(type);Assert.True(context.Available);
        Assert.Equal(minimum,context.Minimum);Assert.Equal(maximum,context.Maximum);
        foreach(var invalid in new[]{minimum-1d,maximum+1d,minimum+0.5,double.NaN,double.PositiveInfinity})
            Assert.Equal("invalid_command",Assert.Throws<CommandRejected>(()=>scalar.Prepare("operator",new(Guid.NewGuid(),type,invalid,context.ExpectedStateRevision))).Code);
        if(type=="setSterilizationMaxTime") {
            Assert.Equal(5,context.Step);
            Assert.Equal("invalid_step",Assert.Throws<CommandRejected>(()=>scalar.Prepare("operator",new(Guid.NewGuid(),type,6,context.ExpectedStateRevision))).Code);
        }
        foreach(var desired in new[]{minimum,maximum}) {
            var c=scalar.Prepare("operator",new(Guid.NewGuid(),type,desired,scalar.Context(type).ExpectedStateRevision));
            Assert.False(curve.Context().Available);
            await scalar.ConfirmAsync("operator",c.Id);await scalar.ConfirmAsync("operator",c.Id);
            clock.Advance(10);scalar.Tick();Assert.Equal(CommandState.Sent,scalar.Get(c.Id).State);
            store.Receive(topic,desired.ToString());scalar.Tick();
            Assert.Equal(CommandState.ObservedMatchingState,scalar.Get(c.Id).State);
            Assert.Equal("matching_state_observed",scalar.Get(c.Id).Reason);
            clock.Advance(30);
        }
        Assert.Equal(2,writer.Sends);
    }
    [Theory]
    [InlineData("setSterilizationTemperature", "main/Sterilization_Temp", 70)]
    [InlineData("setSterilizationMaxTime", "main/Sterilization_Max_Time", 20)]
    public async Task SterilizationSettingsRequireCapabilityFreshnessAndUnchangedRevision(string type,string topic,int desired) {
        foreach(var policy in new[]{new CommandPolicy(),new CommandPolicy(ContinuousMqtt:true),new CommandPolicy(LiveTest:true,ExpiresUtc:clock.GetUtcNow().AddMinutes(5),SterilizationEnabled:true)})
            Assert.Throws<CommandRejected>(()=>policy.Parameter(type));
        var c=scalar.Prepare("operator",new(Guid.NewGuid(),type,desired,scalar.Context(type).ExpectedStateRevision));
        store.Receive(topic,(desired-1).ToString());
        Assert.Equal("state_conflict",(await Assert.ThrowsAsync<CommandRejected>(()=>scalar.ConfirmAsync("operator",c.Id))).Code);
        store.Receive(topic,desired.ToString(),true);Assert.False(scalar.Context(type).Available);
        store.Receive(topic,"NaN");Assert.False(scalar.Context(type).Available);
        Assert.Equal(0,writer.Sends);
        SimulatorSource.Apply(store,"no-error");
        c=scalar.Prepare("operator",new(Guid.NewGuid(),type,desired,scalar.Context(type).ExpectedStateRevision));
        await scalar.ConfirmAsync("operator",c.Id);
        clock.Advance(360);scalar.Tick();Assert.Equal(CommandState.TimedOut,scalar.Get(c.Id).State);
        scalar.Tick();Assert.Equal(1,writer.Sends);
    }
    [Fact]
    public void SterilizationSettingsRemainAvailableDuringHeatingButStartDoesNot() {
        store.Receive("main/Operating_Mode_State", "0");
        Assert.True(scalar.Context("setSterilizationTemperature").Available);
        Assert.True(scalar.Context("setSterilizationMaxTime").Available);
        Assert.False(scalar.Context("startSterilization").Available);
    }
    [Fact] public async Task SterilizationStartsOnceAndObservesIntegerStateWithoutClaimingCompletion() {
        var c=Sterilize();Assert.False(curve.Context().Available);
        await scalar.ConfirmAsync("operator",c.Id);await scalar.ConfirmAsync("operator",c.Id);Assert.Equal(1,writer.Sends);
        scalar.Tick();Assert.Equal(CommandState.Sent,scalar.Get(c.Id).State);
        clock.Advance(10);store.Receive("main/Sterilization_State","1");scalar.Tick();
        Assert.Equal(CommandState.ObservedMatchingState,scalar.Get(c.Id).State);
        Assert.Equal("sterilization_active_observed",scalar.Get(c.Id).Reason);Assert.True(curve.Context().Available);
        Assert.False(scalar.Context("startSterilization").Available);Assert.Throws<CommandRejected>(()=>Sterilize());
        _=new CommandService(store,scalarJournal,writer,new(ContinuousMqtt:true,SterilizationEnabled:true),clock,new());Assert.Equal(1,writer.Sends);
    }
    [Theory][InlineData("main/Sterilization_State","-1",false)][InlineData("main/Sterilization_Temp","65",true)][InlineData("main/Sterilization_Max_Time","NaN",false)]
    public void SterilizationRejectsUnavailableInputsButOtherControlsRemainAvailable(string topic,string value,bool retained) {
        store.Receive(topic,value,retained);Assert.False(scalar.Context("startSterilization").Available);
        Assert.Throws<CommandRejected>(()=>Sterilize());Assert.True(scalar.Context("setDhwTemperature").Available);Assert.Equal(0,writer.Sends);
    }
    [Fact] public async Task SterilizationSettingsConflictAndUnobservedStartNeverRetries() {
        var c=Sterilize();store.Receive("main/Sterilization_Temp","66");
        await Assert.ThrowsAsync<CommandRejected>(()=>scalar.ConfirmAsync("operator",c.Id));Assert.Equal(0,writer.Sends);
        c=Sterilize();await scalar.ConfirmAsync("operator",c.Id);
        clock.Advance(360);store.Receive("main/Sterilization_State","0");scalar.Tick();
        Assert.Equal(CommandState.TimedOut,scalar.Get(c.Id).State);scalar.Tick();Assert.Equal(1,writer.Sends);
    }
    [Theory][InlineData(0)][InlineData(2)][InlineData(0.5)] public void SterilizationOnlyAcceptsExplicitStart(double desired) {
        Assert.Throws<CommandRejected>(()=>scalar.Prepare("operator",new(Guid.NewGuid(),"startSterilization",desired,scalar.Context("startSterilization").ExpectedStateRevision)));
        Assert.Equal(0,writer.Sends);
    }
    [Fact] public void HistoricalModesCannotStartSterilization() {
        var legacy=new CommandService(store,new ScalarJournal(),writer,new(ContinuousMqtt:true),clock);
        Assert.Throws<CommandRejected>(()=>legacy.Context("startSterilization"));
    }
    [Fact] public void SimultaneousReservationsAdmitExactlyOneArea() {
        var success=0;
        Parallel.Invoke(()=>{try{Scalar();Interlocked.Increment(ref success);}catch(CommandRejected){}},()=>{try{Curve();Interlocked.Increment(ref success);}catch(CommandRejected){}});
        Assert.Equal(1,success);Assert.Equal(0,writer.Sends);
    }
}
