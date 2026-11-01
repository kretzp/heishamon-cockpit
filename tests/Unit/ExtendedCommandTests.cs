using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Simulator;
using Xunit;
namespace Cockpit.Unit;
public sealed class ExtendedCommandTests {
    private sealed class Journal : ICommandJournal {
        public List<CommandRecord> Records=[];
        public IReadOnlyList<CommandRecord> Read()=>Records.GroupBy(c=>c.Id).Select(g=>g.Last()).ToArray();
        public void Save(CommandRecord record)=>Records.Add(record);
    }
    private sealed class Sender : ICommandTransport {
        public bool Connected=>true; public long ConnectionEpoch=>0;
        public List<(string,double)> Sends=[];
        public Task SendAsync(string key,double value){Sends.Add((key,value));return Task.CompletedTask;}
    }
    private readonly TestClock clock=new(); private readonly TelemetryStore store;
    private readonly Sender sender=new(); private readonly Journal journal=new(); private readonly CommandService service;
    public ExtendedCommandTests(){store=new(SourceKind.Simulator,clock:clock);SimulatorSource.Apply(store,"no-error");service=new(store,journal,sender,new(ExtendedControlsEnabled:true),clock);}
    private CommandRecord Prepare(string type,double value)=>service.Prepare("operator",new(Guid.NewGuid(),type,value,service.Context(type).ExpectedStateRevision));
    [Theory][InlineData("setQuietMode",3,"main/Quiet_Mode_Level","3")][InlineData("setIndoorTemperature",23,"main/Z1_Heat_Request_Temp","23")]
    [InlineData("setOperatingMode",0,"main/Operating_Mode_State","0")][InlineData("setOperatingMode",1,"main/Operating_Mode_State","1")]
    [InlineData("setOperatingMode",2,"main/Operating_Mode_State","7")][InlineData("setOperatingMode",6,"main/Operating_Mode_State","8")]
    public void ExplicitConfirmationNewReadbackAndNoReplay(string type,double value,string topic,string read){
        var c=Prepare(type,value);Assert.Empty(sender.Sends); service.Confirm("operator",c.Id);service.Confirm("operator",c.Id);Assert.Single(sender.Sends);
        clock.Advance(10);store.Receive(topic,read);service.Tick();Assert.Equal(CommandState.ObservedMatchingState,service.Get(c.Id).State);
        Assert.Equal(double.Parse(read,System.Globalization.CultureInfo.InvariantCulture),service.Get(c.Id).ObservedValue);
        var restarted=new CommandService(store,journal,sender,new(ExtendedControlsEnabled:true),clock);restarted.Tick();Assert.Single(sender.Sends);
    }
    [Theory][InlineData("main/Z1_Sensor_Settings","0")][InlineData("main/Z1_Sensor_Settings","1")][InlineData("main/Zones_State","1")][InlineData("main/Operating_Mode_State","1")][InlineData("main/Operating_Mode_State","7")]
    public void IndoorNeedsRoomSensorActiveZoneAndHeating(string topic,string value){store.Receive(topic,value);Assert.False(service.Context("setIndoorTemperature").Available);Assert.Throws<CommandRejected>(()=>Prepare("setIndoorTemperature",23));Assert.Empty(sender.Sends);}
    [Fact] public void IndoorRetainedAndUnpairedSensorBlock(){store.Receive("main/Z1_Sensor_Settings","2",true);Assert.False(service.Context("setIndoorTemperature").Available);clock.Advance(11);store.Receive("main/Z1_Sensor_Settings","2");Assert.False(service.Context("setIndoorTemperature").Available);}
    [Fact] public void ConfigChangeBeforeConfirmDoesNotSend(){var c=Prepare("setIndoorTemperature",23);store.Receive("main/Z1_Sensor_Settings","0");Assert.Throws<CommandRejected>(()=>service.Confirm("operator",c.Id));Assert.Empty(sender.Sends);}
    [Fact] public void QuietAndModeDoNotRequireDhw(){store.Receive("main/Operating_Mode_State","0");store.Receive("main/DHW_Target_Temp","?");store.Receive("main/DHW_Heat_Delta","?");Assert.True(service.Context("setQuietMode").Available);Assert.True(service.Context("setOperatingMode").Available);Assert.False(service.Context("setDhwTemperature").Available);}
    [Theory][InlineData("setIndoorTemperature",15)][InlineData("setIndoorTemperature",29)][InlineData("setQuietMode",4)][InlineData("setOperatingMode",7)][InlineData("setOperatingMode",8)][InlineData("setOperatingMode",1.5)]
    public void InvalidValuesNeverSend(string type,double value){Assert.Equal(422,Assert.Throws<CommandRejected>(()=>Prepare(type,value)).Status);Assert.Empty(sender.Sends);}
    [Fact] public void AutoCoolingIsSameAutoSelection(){store.Receive("main/Operating_Mode_State","7");Assert.Equal("unchanged_value",Assert.Throws<CommandRejected>(()=>Prepare("setOperatingMode",2)).Code);}
    [Fact] public void OldPoliciesDoNotEnableExtendedCommands(){Assert.Throws<CommandRejected>(()=>new CommandPolicy().Parameter("setOperatingMode"));Assert.Throws<CommandRejected>(()=>new CommandPolicy(LiveTest:true,ExtendedControlsEnabled:true).Parameter("setOperatingMode"));}
    [Theory][InlineData("setQuietMode")][InlineData("setOperatingMode")][InlineData("setIndoorTemperature")]
    public void StaleOrErrorBlocks(string type){store.Receive("main/Error","H76");Assert.False(service.Context(type).Available);SimulatorSource.Apply(store,"no-error");clock.Advance(121);Assert.False(service.Context(type).Available);}
}
