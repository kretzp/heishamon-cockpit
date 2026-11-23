using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Cockpit.Integration;

public sealed class RememberedSessionTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "remember-login-" + Guid.NewGuid().ToString("N"));
    private string DatabasePath => Path.Combine(directory, "users.db");
    private const string Password = "Only-for-isolated-tests-42";
    private UserStore CreateUsers()
    {
        var users = new UserStore(DatabasePath);
        if (!users.HasUsers()) users.CreateInitialAdmin("administrator", Password);
        return users;
    }
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
    [Fact] public void RememberedSessionSurvivesReconstructionStoresOnlyHashAndExpiresWithoutExtension()
    {
        var clock = new Clock(); var users = CreateUsers();
        var account = users.Find("administrator")!;
        var auth = new SimulatorUsers(users, clock);
        var session = auth.CreateSession(account, true);
        Assert.Equal(clock.Now.AddDays(30), session.Expires);
        var restarted = new SimulatorUsers(new UserStore(DatabasePath), clock);
        Assert.True(restarted.Valid(session.Id));
        using (var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = DatabasePath }.ToString()))
        {
            db.Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT TokenHash FROM RememberedSessions";
            var stored = Assert.IsType<string>(command.ExecuteScalar());
            Assert.Equal(64, stored.Length); Assert.NotEqual(session.Id, stored);
        }
        clock.Now = session.Expires.AddSeconds(-1);
        Assert.True(restarted.Valid(session.Id));
        clock.Now = session.Expires;
        Assert.False(restarted.Valid(session.Id));
        Assert.False(restarted.Valid("p_not-a-token"));
    }
    [Fact] public void OrdinarySessionStillLastsThirtyMinutesAndDoesNotSurviveRestart()
    {
        var clock = new Clock(); var users = CreateUsers(); var auth = new SimulatorUsers(users, clock);
        var session = auth.CreateSession(users.Find("administrator")!);
        Assert.Equal(clock.Now.AddMinutes(30), session.Expires);
        Assert.True(auth.Valid(session.Id));
        Assert.False(new SimulatorUsers(users, clock).Valid(session.Id));
        clock.Now = session.Expires; Assert.False(auth.Valid(session.Id));
    }
    [Fact] public void RevocationRemainsEffectiveAfterRestart()
    {
        var users = CreateUsers(); var auth = new SimulatorUsers(users);
        var session = auth.CreateSession(users.Find("administrator")!, true);
        new SimulatorUsers(new UserStore(DatabasePath)).Revoke(session.Id);
        Assert.False(new SimulatorUsers(new UserStore(DatabasePath)).Valid(session.Id));
    }
    [Theory]
    [InlineData("password")][InlineData("role")][InlineData("disabled")]
    public void AccountChangesInvalidatePersistentAndOrdinarySessions(string change)
    {
        var users = CreateUsers(); users.Create("observer", Password, "reader");
        var auth = new SimulatorUsers(users); var account = users.Find("observer")!;
        var normal = auth.CreateSession(account); var remembered = auth.CreateSession(account, true);
        users.Update(account.Username, new(change == "role" ? "writer" : "reader", change == "disabled", change == "password" ? "Changed-password-for-test-42" : null, account.Version));
        Assert.False(auth.Valid(normal.Id)); Assert.False(auth.Valid(remembered.Id));
        Assert.False(new SimulatorUsers(new UserStore(DatabasePath)).Valid(remembered.Id));
    }
    private async Task<WebApplication> Start()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddSingleton(CreateUsers());
        builder.Services.AddSimulatorAuthentication(builder.Configuration, 5080, keyDirectory: Path.Combine(directory, "auth-keys"));
        var app = builder.Build(); app.MapSimulatorControl(scalarCommands: false, loginRequired: true);
        app.MapGet("/protected", () => "ok").RequireAuthorization();
        await app.StartAsync(); return app;
    }
    private static HttpClient Client(WebApplication app, CookieContainer cookies) => new(new HttpClientHandler { CookieContainer = cookies }) {
        BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single())
    };
    private static async Task<string> Csrf(HttpClient client)
    {
        using var response = await client.GetAsync("/api/v1/auth/session");
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(); return json.GetProperty("csrfToken").GetString()!;
    }
    [Theory][InlineData(false)][InlineData(true)]
    public async Task CookiePersistenceRestartAndLogoutAgreeWithRememberChoice(bool remember)
    {
        var cookies = new CookieContainer();
        await using (var app = await Start())
        {
            using var client = Client(app, cookies);
            client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", await Csrf(client));
            using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { username = "administrator", password = Password, rememberMe = remember });
            Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
            var cookie = login.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("Cockpit.Simulator."));
            Assert.Contains("httponly", cookie.ToLowerInvariant()); Assert.Contains("samesite=strict", cookie.ToLowerInvariant());
            Assert.Equal(remember, cookie.Contains("expires=", StringComparison.OrdinalIgnoreCase));
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/protected")).StatusCode);
            await app.StopAsync();
        }
        await using (var app = await Start())
        {
            using var client = Client(app, cookies);
            Assert.Equal(remember ? HttpStatusCode.OK : HttpStatusCode.Unauthorized, (await client.GetAsync("/protected")).StatusCode);
            if (remember)
            {
                var replay = cookies.GetCookieHeader(client.BaseAddress!);
                client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", await Csrf(client));
                Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/v1/auth/logout", new { })).StatusCode);
                using var attacker = new HttpClient(new HttpClientHandler { UseCookies = false }) { BaseAddress = client.BaseAddress };
                attacker.DefaultRequestHeaders.Add("Cookie", replay);
                Assert.Equal(HttpStatusCode.Unauthorized, (await attacker.GetAsync("/protected")).StatusCode);
            }
            await app.StopAsync();
        }
    }
    public void Dispose() { SqliteConnection.ClearAllPools(); if (Directory.Exists(directory)) Directory.Delete(directory, true); }
}
