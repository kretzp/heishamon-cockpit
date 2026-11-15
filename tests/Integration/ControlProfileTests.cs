using System.Text.Json;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using Xunit;

namespace Cockpit.Integration;

public sealed class ControlProfileTests
{
    [Theory]
    [InlineData(true, true, true, true)]
    [InlineData(false, true, true, false)]
    [InlineData(true, false, true, false)]
    [InlineData(true, true, false, false)]
    public void GenericProfileStillRequiresEveryConfirmation(bool profile, bool credentials, bool writers, bool accepted)
    {
        var root = Path.Combine(Path.GetTempPath(), "control-profile-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new ControlSetupStore(Path.Combine(root, "control.json"));
            var options = new MqttReadOptions { Username = "operator", Password = "test-only" };
            var input = new ControlSetupInput(true, HeatingCurve.Profile, profile, credentials, writers, 0);
            if (accepted)
                Assert.True(store.Save(input, "mqtt", options, false).Enabled);
            else
            {
                Assert.Equal("control_confirmation_required", Assert.Throws<CommandRejected>(() => store.Save(input, "mqtt", options, false)).Code);
                Assert.False(store.Read().Enabled);
            }
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    [Fact]
    public void LegacySavedProfileLoadsAndMigratesWhenSavedAgain()
    {
        var root = Path.Combine(Path.GetTempPath(), "control-profile-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(root);
            var path = Path.Combine(root, "control.json");
            var options = new MqttReadOptions();
            var binding = ControlSetupStore.Binding("simulator", options);
            File.WriteAllText(path, JsonSerializer.Serialize(new ControlSetup(true, HeatingCurve.LegacyProfile, binding, 4)));
            var store = new ControlSetupStore(path);
            Assert.True(store.Read().Enabled);
            var saved = store.Save(new(true, HeatingCurve.Profile, true, false, true, 4), "simulator", options, false);
            Assert.Equal(HeatingCurve.Profile, saved.Profile);
            Assert.Equal(binding, saved.BrokerBinding);
            Assert.True(new ControlSetupStore(path).Read().Enabled);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
}
