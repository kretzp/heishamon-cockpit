using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Cockpit.Integration;

public sealed class LoginRateLimitTests
{
    [Fact]
    public async Task ExhaustingOneClientDoesNotBlockAnotherOrTrustForwardedHeaders()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddSimulatorAuthentication(builder.Configuration, 5080);
        await using var app = builder.Build();
        // Test-only transport shim: emulate distinct socket peers on a loopback server.
        app.Use((context, next) => {
            context.Connection.RemoteIpAddress = IPAddress.Parse(context.Request.Headers["X-Test-Peer"].ToString());
            return next(context);
        });
        app.UseRateLimiter();
        app.MapPost("/api/v1/auth/login", () => Results.NoContent()).RequireRateLimiting("login");
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()!.Addresses.Single()) };
        async Task<HttpStatusCode> Login(string peer, string forwarded)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login");
            request.Headers.Add("X-Test-Peer", peer);
            request.Headers.Add("X-Forwarded-For", forwarded);
            using var response = await client.SendAsync(request);
            return response.StatusCode;
        }
        for (var attempt = 0; attempt < 5; attempt++)
            Assert.Equal(HttpStatusCode.NoContent, await Login("192.0.2.1", "198.51.100.1"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await Login("192.0.2.1", "198.51.100.2"));
        Assert.Equal(HttpStatusCode.NoContent, await Login("192.0.2.2", "198.51.100.1"));
        // IPv4-mapped IPv6 is the same peer, not a new quota.
        Assert.Equal(HttpStatusCode.TooManyRequests, await Login("::ffff:192.0.2.1", "198.51.100.3"));
    }
}
