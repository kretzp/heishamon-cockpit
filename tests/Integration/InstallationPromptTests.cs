using Xunit;

namespace Cockpit.Integration;

public sealed class InstallationPromptTests
{
    [Theory]
    [InlineData("y", true)]
    [InlineData("YES", true)]
    [InlineData(" Y ", true)]
    [InlineData("n", false)]
    [InlineData("No", false)]
    [InlineData("", false)]
    public void AcceptsShortAnswersAndKeepsDefaultNo(string answer, bool expected)
    {
        using var input = new StringReader(answer + "\n");
        using var output = new StringWriter();
        Assert.Equal(expected, InstallationSetup.ReadYesNo("Confirm", input, output));
        Assert.DoesNotContain("Invalid", output.ToString());
    }

    [Theory]
    [InlineData("maybe\nyesplease\ny\n", true)]
    [InlineData("maybe\nn\n", false)]
    public void RepeatsInvalidAnswersUntilAValidAnswerArrives(string answers, bool expected)
    {
        using var input = new StringReader(answers);
        using var output = new StringWriter();
        Assert.Equal(expected, InstallationSetup.ReadYesNo("Confirm", input, output));
        Assert.Contains("Invalid value", output.ToString());
        Assert.True(output.ToString().Split("Confirm").Length > 2);
    }

    [Fact]
    public void EndOfInputDoesNotBecomeConsentOrAnInfiniteRetry()
    {
        using var input = new StringReader("invalid\n");
        using var output = new StringWriter();
        Assert.Throws<EndOfStreamException>(() => InstallationSetup.ReadYesNo("Confirm", input, output));
    }
}
