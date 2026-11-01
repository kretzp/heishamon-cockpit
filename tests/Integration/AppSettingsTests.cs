using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Xunit;
namespace Cockpit.Integration;
public sealed class AppSettingsTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "cockpit-settings-" + Guid.NewGuid());
    private string FilePath => Path.Combine(directory, "settings.json");
    public void Dispose() { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
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
