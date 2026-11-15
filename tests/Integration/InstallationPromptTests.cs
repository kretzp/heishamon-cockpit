using Xunit;

namespace Cockpit.Integration;

public sealed class InstallationPromptTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    [InlineData(11)]
    [InlineData(129)]
    public void InvalidPasswordLengthRetriesBeforeRequestingConfirmation(int length)
    {
        var answers = new Queue<string>([new string('x', length), "valid-password", "valid-password"]);
        var prompts = new List<string>();
        using var output = new StringWriter();
        var password = InstallationSetup.ReadAdministratorPassword(label =>
        {
            prompts.Add(label);
            return answers.Dequeue();
        }, output);

        Assert.Equal("valid-password", password);
        Assert.Equal(prompts[0], prompts[1]);
        Assert.Contains("12", output.ToString());
        Assert.Contains("128", output.ToString());
        Assert.DoesNotContain("valid-password", output.ToString());
        Assert.Empty(answers);
    }

    [Theory]
    [InlineData(12)]
    [InlineData(128)]
    public void PasswordLengthBoundariesAreAccepted(int length)
    {
        var expected = new string('x', length);
        var answers = new Queue<string>([expected, expected]);
        using var output = new StringWriter();
        Assert.Equal(expected, InstallationSetup.ReadAdministratorPassword(_ => answers.Dequeue(), output));
        Assert.Empty(answers);
        Assert.Equal("", output.ToString());
    }

    [Fact]
    public void PasswordMismatchRetriesWithoutAbortingSetup()
    {
        var answers = new Queue<string>(["first-password", "other-password", "new-password", "new-password"]);
        using var output = new StringWriter();
        Assert.Equal("new-password", InstallationSetup.ReadAdministratorPassword(_ => answers.Dequeue(), output));
        Assert.Contains("Passwords do not match", output.ToString());
        Assert.DoesNotContain("first-password", output.ToString());
        Assert.Empty(answers);
    }

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
