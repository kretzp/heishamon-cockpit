using Cockpit.Domain;
using Cockpit.Application;
using Cockpit.Infrastructure.Persistence;
using Xunit;
namespace Cockpit.Integration;
public sealed class AppSettingsTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "cockpit-settings-" + Guid.NewGuid());
    private string FilePath => Path.Combine(directory, "settings.json");
    public void Dispose() { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    [Fact] public void RelaySwitchingDefaultsOffAndSurvivesRestart()
    {
        var store = new AppSettingsStore(FilePath, 700);
        Assert.False(store.Read().EnableRelaySwitching);
        store.Save(store.Read() with { EnableRelaySwitching = true }, false);
        Assert.True(new AppSettingsStore(FilePath, 700).Read().EnableRelaySwitching);
    }
    [Fact] public void AlternativeSettingsSurviveRestartAndOnlyPowerChangesAdvanceGeneration()
    {
        var store = new AppSettingsStore(FilePath, 700);
        var power = new AlternativePowerOptions(true, new("meter", "$.power"), new("heater", ""));
        var saved = store.Save(new("House", 700) { AlternativePower = power }, false);
        Assert.Equal(1, saved.PowerGeneration);
        Assert.Equal(power, new AppSettingsStore(FilePath, 700).Read().AlternativePower);
        var renamed = store.Save(saved with { PlantName = "Renamed" }, false);
        Assert.Equal(1, renamed.PowerGeneration);
        var disabled = store.Save(renamed with { AlternativePower = power with { Enabled = false } }, false);
        Assert.Equal(2, disabled.PowerGeneration);
        Assert.Equal(power.Heatpump, disabled.AlternativePower.Heatpump);
        Assert.Throws<CommandRejected>(() => store.Save(disabled with { AlternativePower = power with { Heatpump = new("meter/#", "$.power") } }, false));
        Assert.Equal(disabled, store.Read());
    }
    [Fact] public void SavesAndReloadsWithoutChangingDefaultsBeforeSave()
    {
        var store = new AppSettingsStore(FilePath, 700);
        Assert.Equal(700, store.Read().RetentionDays);
        var saved = store.Save(new(" Haus ", 600, 0), true);
        Assert.Equal("Haus", saved.PlantName);
        Assert.Equal(1, saved.Revision);
        Assert.Equal(saved, new AppSettingsStore(FilePath, 700).Read());
    }
    [Fact] public void RejectsLostUpdatesAndUnconfirmedDeletion()
    {
        var store = new AppSettingsStore(FilePath, 700);
        Assert.Equal("retention_confirmation_required", Assert.Throws<CommandRejected>(() => store.Save(new("Haus", 699), false)).Code);
        Assert.False(File.Exists(FilePath));
        store.Save(new("Haus", 700), false);
        Assert.Equal("settings_conflict", Assert.Throws<CommandRejected>(() => store.Save(new("Andere", 700), false)).Code);
        Assert.Equal("Haus", new AppSettingsStore(FilePath, 700).Read().PlantName);
    }
    [Theory][InlineData("",700)][InlineData("Haus\nName",700)][InlineData("Haus",0)][InlineData("Haus",701)]
    public void InvalidInputPreservesState(string name,int days)
    {
        var store = new AppSettingsStore(FilePath, 700);
        Assert.Throws<CommandRejected>(() => store.Save(new(name, days), true));
        Assert.Equal(0, store.Read().Revision);
    }
    [Fact] public void FailedWriteDoesNotChangeActiveValue()
    {
        Directory.CreateDirectory(directory);
        var store = new AppSettingsStore(FilePath, 700);
        Directory.CreateDirectory(FilePath);
        Assert.Throws<CommandRejected>(() => store.Save(new("Haus", 700), false));
        Assert.Equal(0, store.Read().Revision);
    }
}
