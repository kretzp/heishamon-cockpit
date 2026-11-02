using Cockpit.Application;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Cockpit.Integration;

public sealed class UpdateReadinessTests
{
    [Theory]
    [InlineData("starting", 503)]
    [InlineData("failed", 503)]
    [InlineData("ready", 200)]
    public void UpdateReadinessRequiresSuccessfulHistoryInitialization(string state, int expected)
    {
        var result = HistoryEndpoints.Readiness(new StorageStatus(state, null, 30, 700));
        Assert.Equal(expected, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
    }
}
