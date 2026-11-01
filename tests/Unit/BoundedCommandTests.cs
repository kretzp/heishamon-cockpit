using Cockpit.Application;
using Cockpit.Domain;
using Xunit;
namespace Cockpit.Unit;

// Pure in-memory tests. No MQTT transport or sockets are used.
public sealed class BoundedCommandTests
{
    private sealed class MemoryJournal : ICommandJournal
    {
        public readonly List<CommandRecord> Rows=[];
        public bool Fail;
        public IReadOnlyList<CommandRecord> Read()=>Rows.GroupBy(c=>c.Id).Select(g=>g.Last()).ToArray();
        public void Save(CommandRecord c) { if(Fail)throw new IOException();Rows.Add(c); }
    }
    private sealed class FakeTransport : ICommandTransport
    {
        public bool Connected { get; set; }=true;
        public long ConnectionEpoch { get; set; }
        public int Sends;
        public bool Fail;
        public Task SendAsync(string key,double value) { Sends++;return Fail ? Task.FromException(new IOException()) : Task.CompletedTask; }
    }
    private readonly TestClock clock=new();
    private readonly TelemetryStore store;
    private readonly MemoryJournal journal=new();
    private readonly FakeTransport transport=new();
    private readonly CommandPolicy policy;
    private readonly CommandService commands;
    public BoundedCommandTests()
    {
        store=new(SourceKind.Mqtt,new TelemetryPolicy(360,10),clock);
        store.SetConnection(true);store.Receive("LWT","Online");Refresh(52);
        policy=new(true,clock.Now.AddMinutes(30));commands=new(store,journal,transport,policy,clock);
    }
    private void Refresh(double value)
    {
        store.Receive("main/DHW_Target_Temp",value.ToString(System.Globalization.CultureInfo.InvariantCulture));
        store.Receive("main/DHW_Heat_Delta","-8");store.Receive("main/Operating_Mode_State","4");store.Receive("main/Error","no error");
    }
    private CommandRecord Prepare(double value=51)=>commands.Prepare("operator",new(Guid.NewGuid(),"setDhwTemperature",value,commands.Context("setDhwTemperature").ExpectedStateRevision));
    [Fact] public void ExactlyTwoAttemptsAndExpectedOrderSurviveRestart()
    {
        var c=Prepare();commands.Confirm("operator",c.Id);clock.Advance(30);Refresh(51);commands.Tick();
        Assert.Equal(CommandState.ObservedMatchingState,commands.Get(c.Id).State);
        c=Prepare(52);commands.Confirm("operator",c.Id);clock.Advance(30);Refresh(52);commands.Tick();
        Assert.Equal(2,transport.Sends);Assert.False(commands.Context("setDhwTemperature").Available);
        var restarted=new CommandService(store,journal,transport,policy,clock);
        Assert.Equal(0,restarted.Context("setDhwTemperature").RemainingSends);
        Assert.Throws<CommandRejected>(()=>restarted.Prepare("operator",new(Guid.NewGuid(),"setDhwTemperature",51,restarted.Context("setDhwTemperature").ExpectedStateRevision)));
        Assert.Equal(2,transport.Sends);
    }
    [Fact] public void DeltaAndOtherValuesAreNeverAllowed()
    {
        Assert.Equal(403,Assert.Throws<CommandRejected>(()=>commands.Context("setDhwHeatDelta")).Status);
        Assert.Equal(422,Assert.Throws<CommandRejected>(()=>Prepare(53)).Status);
        Assert.Equal(0,transport.Sends);
    }
    [Fact] public void WrongInitialStateOrDeltaBlocksPreparation()
    {
        Refresh(51);Assert.False(commands.Context("setDhwTemperature").Available);Assert.Throws<CommandRejected>(()=>Prepare(52));
        Refresh(52);store.Receive("main/DHW_Heat_Delta","-7");Assert.False(commands.Context("setDhwTemperature").Available);
    }
    [Fact] public void ExpirationBetweenPrepareAndConfirmPreventsSend()
    {
        var c=Prepare();clock.Advance(1801);Refresh(52);
        Assert.Equal("test_window_closed",Assert.Throws<CommandRejected>(()=>commands.Confirm("operator",c.Id)).Code);Assert.Equal(0,transport.Sends);
    }
    [Fact] public void WriterReconnectInvalidatesPreparedContext()
    {
        var c=Prepare();transport.ConnectionEpoch++;
        Assert.Throws<CommandRejected>(()=>commands.Confirm("operator",c.Id));Assert.Equal(0,transport.Sends);
    }
    [Fact] public void FailedDeliveryConsumesBudgetAndCannotRepeatInitialSend()
    {
        var c=Prepare();transport.Fail=true;commands.Confirm("operator",c.Id);clock.Advance(31);Refresh(52);
        Assert.Equal(CommandState.Failed,commands.Get(c.Id).State);Assert.Throws<CommandRejected>(()=>Prepare());Assert.Equal(1,transport.Sends);
    }
    [Fact] public void AuditFailureDoesNotCallTransport()
    {
        var c=Prepare();journal.Fail=true;Assert.Throws<CommandRejected>(()=>commands.Confirm("operator",c.Id));Assert.Equal(0,transport.Sends);
    }
    [Fact] public void FullPublishIntervalIsAllowedBeforeTimeout()
    {
        var c=Prepare();commands.Confirm("operator",c.Id);clock.Advance(300);Refresh(52);commands.Tick();Assert.Equal(CommandState.Sent,commands.Get(c.Id).State);
        clock.Advance(60);Refresh(52);commands.Tick();Assert.Equal(CommandState.TimedOut,commands.Get(c.Id).State);
    }
    [Fact] public void SimulatorAuditCannotBeReusedForRealSource()
    {
        journal.Rows.Add(new(Guid.NewGuid(),Guid.NewGuid(),"test","setDhwTemperature",50,51,null,"x",CommandState.Validated,clock.Now,clock.Now,null,"validated"));
        Assert.Throws<ArgumentException>(()=>new CommandService(store,journal,transport,policy,clock));
    }
}
