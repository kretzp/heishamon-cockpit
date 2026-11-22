using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cockpit.Application;
using Cockpit.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Cockpit.Integration;

public sealed class PlantModelSettingsTests
{
    [Fact]
    public async Task OnlyAdminWithCsrfCanSaveInstallationConfiguration()
    {
        var directory = Path.Combine(Path.GetTempPath(), "plant-model-" + Guid.NewGuid().ToString("N"));
        try
        {
            var users = new UserStore(Path.Combine(directory, "users.db"));
            const string password = "Only-for-isolated-tests-42";
            users.CreateInitialAdmin("administrator", password);
            users.Create("operator", password, "writer");
            users.Create("observer", password, "reader");
            var settings = new AppSettingsStore(Path.Combine(directory, "settings.json"), 700);
            var builder = WebApplication.CreateBuilder();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services.AddSingleton(users);
            builder.Services.AddSingleton(settings);
            builder.Services.AddSimulatorAuthentication(builder.Configuration, 5080);
            await using var app = builder.Build();
            app.MapSimulatorControl(scalarCommands: false);
            app.MapPlantModelSettings(true);
            await app.StartAsync();
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            var configuration = new PlantModelOptions { Zones = 2, Zone1 = "radiator", Buffer = true, HouseTemperature = new(true, new("house/sensor", "$.temperature")) };
            foreach (var username in new[] { "anonymous", "observer", "operator", "administrator" })
            {
                using var handler = new HttpClientHandler { CookieContainer = new CookieContainer() };
                using var client = new HttpClient(handler) { BaseAddress = new Uri(address) };
                async Task<string> Csrf()
                {
                    var session = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/session");
                    return session.GetProperty("csrfToken").GetString()!;
                }
                var token = await Csrf();
                if (username != "anonymous")
                {
                    client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token);
                    using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { username, password });
                    Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
                    client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
                    token = await Csrf();
                }
                Assert.True((await client.GetAsync("/api/v1/settings/plant-model")).IsSuccessStatusCode);
                if (username == "administrator")
                {
                    using var noCsrf = await client.PostAsJsonAsync("/api/v1/settings/plant-model", new { configuration, revision = 0 });
                    Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);
                }
                client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token);
                using var response = await client.PostAsJsonAsync("/api/v1/settings/plant-model", new { configuration, revision = 0 });
                Assert.Equal(username == "administrator" ? HttpStatusCode.OK : username == "anonymous" ? HttpStatusCode.Unauthorized : HttpStatusCode.Forbidden, response.StatusCode);
                if (username != "administrator") { Assert.Equal(0, settings.Read().Revision); continue; }
                using var conflict = await client.PostAsJsonAsync("/api/v1/settings/plant-model", new { configuration, revision = 0 });
                Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
                using var invalid = await client.PostAsJsonAsync("/api/v1/settings/plant-model", new { configuration = configuration with { Zones = 6 }, revision = 1 });
                Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
            }
            Assert.Equal(configuration, new AppSettingsStore(Path.Combine(directory, "settings.json"), 700).Read().PlantModel);
            Assert.False(settings.Read().EnableRelaySwitching);
            await app.StopAsync();
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
}
