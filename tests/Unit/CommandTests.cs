using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;
namespace Cockpit.Unit;

public sealed class CommandTests
{
    private sealed class Journal : ICommandJournal
    {
        public List<CommandRecord> Audit = [];
        public bool Fail;
        public IReadOnlyList<CommandRecord> Read() => Audit.GroupBy(c => c.Id).Select(g => g.Last()).ToArray();
        public void Save(CommandRecord record) { if (Fail) throw new IOException(); Audit.Add(record); }
    }
    private sealed class Sender : ISimulatorCommands
    {
        public int Count; public bool Fail;
        public void SetValue(string key, double value) { Count++; if (Fail) throw new IOException(); }
    }
    private readonly TestClock clock = new();
    private readonly TelemetryStore store;
    private readonly Journal journal = new();
    private readonly Sender sender = new();
    private readonly CommandService commands;
    public CommandTests()
    {
        store = new(SourceKind.Simulator, clock: clock); SimulatorSource.Apply(store,"no-error");
        commands = new(store,journal,sender,clock);
    }
    private CommandRequest Request(string type = "setDhwTemperature", double value = 51) => new(Guid.NewGuid(),type,value,commands.Context(type).ExpectedStateRevision);
    private CommandRecord Prepare() => commands.Prepare("operator",Request());
    [Fact] public void DraftRequiresConfirmationAndDuplicateConfirmNeverResends()
    {
        var request = Request(); var c = commands.Prepare("operator",request);
        Assert.Equal(CommandState.Validated,c.State); Assert.Equal(0,sender.Count);
        Assert.Equal(c,commands.Prepare("operator",request));
        commands.Confirm("operator",c.Id); commands.Confirm("operator",c.Id);
        Assert.Equal(1,sender.Count); Assert.Equal(3,journal.Audit.Count);
    }
    [Fact] public void ConflictingIdempotencyKeyRejected()
    {
        var request = Request(); commands.Prepare("operator",request);
        Assert.Equal("idempotency_conflict",Assert.Throws<CommandRejected>(() => commands.Prepare("operator", request with { DesiredValue = 52 })).Code);
    }
    [Theory] [InlineData(39)] [InlineData(61)] [InlineData(50.5)] [InlineData(double.NaN)]
    public void InvalidTargetRejected(double value) => Assert.Equal(422,Assert.Throws<CommandRejected>(() => commands.Prepare("operator",Request(value:value))).Status);
    [Theory] [InlineData(-13)] [InlineData(-1)] [InlineData(2)] [InlineData(-5.5)]
    public void InvalidDeltaRejected(double value) => Assert.Equal(422,Assert.Throws<CommandRejected>(() => commands.Prepare("operator",Request("setDhwHeatDelta",value))).Status);
    [Theory] [InlineData(-12)] [InlineData(-2)]
    public void DeltaLimitsAndReadback(double value)
    {
        var c = commands.Prepare("operator",Request("setDhwHeatDelta",value)); commands.Confirm("operator",c.Id);
        clock.Advance(10); store.Receive("main/DHW_Heat_Delta",value.ToString(System.Globalization.CultureInfo.InvariantCulture)); commands.Tick();
        Assert.Equal(CommandState.ObservedMatchingState,commands.Get(c.Id).State);
    }
    [Fact] public void MatchingReadbackMustBeNewAndAfterTenSeconds()
    {
        var c=Prepare(); commands.Confirm("operator",c.Id); store.Receive("main/DHW_Target_Temp","51"); clock.Advance(10); commands.Tick();
        Assert.Equal(CommandState.Sent,commands.Get(c.Id).State);
        store.Receive("main/DHW_Target_Temp","51"); commands.Tick(); Assert.Equal(CommandState.ObservedMatchingState,commands.Get(c.Id).State);
    }
    [Fact] public void WrongReadbackTimesOutWithoutRetry()
    {
        var c=Prepare(); commands.Confirm("operator",c.Id); clock.Advance(20); store.Receive("main/DHW_Target_Temp","52"); commands.Tick();
        Assert.Equal(CommandState.TimedOut,commands.Get(c.Id).State); Assert.Equal(1,sender.Count);
    }
    [Fact] public void ReconnectEvenWithFreshIdenticalValuesCancels()
    {
        var c=Prepare(); commands.Confirm("operator",c.Id); store.SetConnection(false); store.SetConnection(true);
        store.Receive("LWT","Online"); foreach (var v in new[] { ("main/DHW_Target_Temp","50"),("main/DHW_Heat_Delta","-5"),("main/Operating_Mode_State","4"),("main/Error","no error") }) store.Receive(v.Item1,v.Item2);
        commands.Tick(); Assert.Equal(CommandState.Cancelled,commands.Get(c.Id).State); Assert.Equal(1,sender.Count);
    }
    [Theory] [InlineData("main/Operating_Mode_State","3")] [InlineData("main/DHW_Target_Temp","49")] [InlineData("main/DHW_Heat_Delta","-6")]
    public void ChangedStateBeforeConfirmPreventsSend(string topic,string value)
    {
        var c=Prepare(); store.Receive(topic,value); Assert.Throws<CommandRejected>(() => commands.Confirm("operator",c.Id)); Assert.Equal(0,sender.Count);
    }
    [Fact] public void RetainedStaleOfflineAndErrorBlockCommands()
    {
        store.Receive("main/DHW_Target_Temp","50",true); Assert.False(commands.Context("setDhwTemperature").Available);
        SimulatorSource.Apply(store,"no-error"); clock.Advance(121); Assert.False(commands.Context("setDhwTemperature").Available);
        SimulatorSource.Apply(store,"offline"); Assert.False(commands.Context("setDhwTemperature").Available);
        SimulatorSource.Apply(store,"normal"); Assert.False(commands.Context("setDhwTemperature").Available);
    }
    [Fact] public void AuditFailureBeforeSendLatchesWriteBlock()
    {
        var c=Prepare(); journal.Fail=true; Assert.Equal(503,Assert.Throws<CommandRejected>(() => commands.Confirm("operator",c.Id)).Status);
        Assert.Equal(0,sender.Count); journal.Fail=false; Assert.False(commands.Context("setDhwTemperature").Available);
    }
    [Fact] public void RestartCancelsPendingWithoutReplay()
    {
        var c=Prepare(); commands.Confirm("operator",c.Id); var restarted = new CommandService(store,journal,sender,clock);
        Assert.Equal(CommandState.Cancelled,restarted.Get(c.Id).State); Assert.Equal(1,sender.Count);
    }
    [Fact] public void OwnershipBusyUnchangedExpiryAndSpacing()
    {
        Assert.Equal("unchanged_value",Assert.Throws<CommandRejected>(() => commands.Prepare("operator",Request(value:50))).Code);
        var c=Prepare(); Assert.Equal(403,Assert.Throws<CommandRejected>(()=>commands.Confirm("other",c.Id)).Status);
        Assert.Equal("command_pending",Assert.Throws<CommandRejected>(()=>commands.Prepare("other",Request())).Code);
        clock.Advance(61); Assert.Throws<CommandRejected>(()=>commands.Confirm("operator",c.Id)); Assert.Equal(0,sender.Count);
        c=Prepare(); commands.Confirm("operator",c.Id); clock.Advance(20); commands.Tick();
        Assert.Equal("change_interval",Assert.Throws<CommandRejected>(()=>commands.Prepare("operator",Request())).Code);
    }
    [Fact] public void TransportFailureIsAudited()
    {
        var c=Prepare(); sender.Fail=true; Assert.Equal(CommandState.Failed,commands.Confirm("operator",c.Id).State); Assert.Equal(1,sender.Count);
    }
    [Fact] public void CancelledDraftDoesNotSendAndUnknownCommandRejected()
    {
        var c=Prepare(); commands.Cancel("operator",c.Id); commands.Confirm("operator",c.Id); Assert.Equal(0,sender.Count);
        Assert.Throws<CommandRejected>(()=>commands.Prepare("operator",new(Guid.NewGuid(),"forceDefrost",1,"x")));
    }
    [Fact] public void MqttTelemetryCannotBeControlled()
    {
        var mqtt = new TelemetryStore(SourceKind.Mqtt); SimulatorSource.Apply(mqtt,"no-error");
        var service = new CommandService(mqtt,new Journal(),sender,clock);
        Assert.False(service.Context("setDhwTemperature").Available);
        Assert.Throws<CommandRejected>(()=>service.Prepare("operator",Request())); Assert.Equal(0,sender.Count);
    }
    [Theory] [InlineData("-12",Quality.Valid)] [InlineData("-2",Quality.Valid)] [InlineData("-13",Quality.Invalid)] [InlineData("-1",Quality.Invalid)] [InlineData("-5.5",Quality.Invalid)] [InlineData("NaN",Quality.Invalid)]
    public void Top22ReadValidation(string payload,Quality quality)
    {
        var metric=Catalog.Metrics.Single(m=>m.Key=="dhwHeatDelta"); Assert.Equal(Catalog.Kelvin,metric.Unit);
        Assert.Equal(quality,TelemetryStore.Parse(metric,payload).Quality);
    }
}
