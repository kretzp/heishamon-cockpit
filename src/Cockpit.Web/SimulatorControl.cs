using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Threading.RateLimiting;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;

public sealed record ControlAccount(string Username, string Role, string PasswordHash);
public sealed record LoginInput(string Username, string Password);
public sealed record Confirmation(bool Confirmed);
public sealed class SimulatorUsers(UserStore users)
{
    private readonly ConcurrentDictionary<string, (string Username, long Version, DateTimeOffset Expires)> sessions = new();
    public UserAccount? Verify(LoginInput input) => users.Verify(input.Username, input.Password);
    public string CreateSession(UserAccount account)
    {
        foreach (var pair in sessions.Where(p => p.Value.Expires <= DateTimeOffset.UtcNow)) sessions.TryRemove(pair.Key, out _);
        if (sessions.Count >= 100) throw new CommandRejected(429, "session_limit");
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        sessions[id] = (account.Username, account.Version, DateTimeOffset.UtcNow.AddMinutes(30)); return id;
    }
    public bool Valid(string? id)
    {
        if (id is null || !sessions.TryGetValue(id, out var session) || session.Expires <= DateTimeOffset.UtcNow) return false;
        var account = users.Find(session.Username);
        return account is { Disabled: false } && account.Version == session.Version;
    }
    public void Revoke(string? id) { if (id is not null) sessions.TryRemove(id, out _); }
}

public static class SimulatorControl
{
    public static void AddSimulatorAuthentication(this IServiceCollection services, IConfiguration configuration, int port, bool requireHttps = false)
    {
        services.AddSingleton<SimulatorUsers>();
        services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "Cockpit.Csrf." + port; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.HttpOnly = true; o.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest; });
        services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o => {
            o.Cookie.Name = "Cockpit.Simulator." + port; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = requireHttps ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
            o.ExpireTimeSpan = TimeSpan.FromMinutes(30); o.SlidingExpiration = false;
            o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
            o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
            o.Events.OnValidatePrincipal = c => {
                if (!c.HttpContext.RequestServices.GetRequiredService<SimulatorUsers>().Valid(c.Principal?.FindFirstValue("sid"))) c.RejectPrincipal();
                return Task.CompletedTask;
            };
        });
        services.AddAuthorization(o => { o.AddPolicy("simulator-operator", p => p.RequireAuthenticatedUser().RequireRole("writer", "admin")); o.AddPolicy("admin", p => p.RequireAuthenticatedUser().RequireRole("admin")); });
        services.AddRateLimiter(o => {
            o.RejectionStatusCode = 429;
            o.AddFixedWindowLimiter("login", p => { p.PermitLimit = 5; p.Window = TimeSpan.FromMinutes(1); p.QueueLimit = 0; });
            o.AddFixedWindowLimiter("commands", p => { p.PermitLimit = 30; p.Window = TimeSpan.FromMinutes(1); p.QueueLimit = 0; });
        });
    }
    public static void MapSimulatorControl(this WebApplication app, bool requireHttps = false, bool scalarCommands = true, bool loginRequired = false)
    {
        app.Use(async (context,next) => {
            if (requireHttps && !context.Request.IsHttps && (loginRequired && (context.Request.Path.StartsWithSegments("/api") || context.Request.Path.StartsWithSegments("/hubs")) || context.Request.Path.StartsWithSegments("/api/v1/auth") || context.Request.Path.StartsWithSegments("/api/v1/settings") || context.Request.Path.StartsWithSegments("/api/v1/users") || context.Request.Path.StartsWithSegments("/api/v1/commands") || context.Request.Path.StartsWithSegments("/api/v1/heating-curve")))
            { context.Response.StatusCode = 403; return; }
            await next(context);
        });
        app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
        app.Use(async (context, next) => {
            try {
                if (context.Request.Method == "POST" && (context.Request.Path.StartsWithSegments("/api/v1/auth") || context.Request.Path.StartsWithSegments("/api/v1/settings") || context.Request.Path.StartsWithSegments("/api/v1/users") || context.Request.Path.StartsWithSegments("/api/v1/commands") || context.Request.Path.StartsWithSegments("/api/v1/heating-curve")))
                    await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
                await next(context);
            } catch (AntiforgeryValidationException) {
                await Results.Problem(statusCode: 400, title: "Ungültiger Sitzungsschutz.", extensions: new Dictionary<string,object?> { ["errorCode"] = "csrf_invalid" }).ExecuteAsync(context);
            } catch (CommandRejected error) {
                await Results.Problem(statusCode: error.Status, title: "Anfrage nicht ausgeführt.", extensions: new Dictionary<string,object?> { ["errorCode"] = error.Code }).ExecuteAsync(context);
            }
        });
        app.MapGet("/api/v1/auth/session", (HttpContext c, IAntiforgery csrf) => Results.Ok(new {
            loginRequired, authenticated = c.User.Identity?.IsAuthenticated == true, username = c.User.Identity?.Name,
            role = c.User.FindFirstValue(ClaimTypes.Role), csrfToken = csrf.GetAndStoreTokens(c).RequestToken
        }));
        app.MapPost("/api/v1/auth/login", async (LoginInput input, HttpContext c, SimulatorUsers users) => {
            var account = users.Verify(input); if (account is null) return Results.Unauthorized();
            users.Revoke(c.User.FindFirstValue("sid"));
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, account.Username), new Claim(ClaimTypes.Role, account.Role), new Claim("sid", users.CreateSession(account)) }, CookieAuthenticationDefaults.AuthenticationScheme);
            await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity)); return Results.NoContent();
        }).RequireRateLimiting("login");
        app.MapPost("/api/v1/auth/logout", async (HttpContext c, SimulatorUsers users) => {
            users.Revoke(c.User.FindFirstValue("sid")); await c.SignOutAsync(); return Results.NoContent();
        }).RequireAuthorization();
        var userApi = app.MapGroup("/api/v1/users").RequireAuthorization("admin");
        userApi.MapGet("", (UserStore users) => Results.Ok(users.List()));
        userApi.MapPost("", (CreateUserInput input, UserStore users) => { users.Create(input.Username, input.Password, input.Role); return Results.NoContent(); }).RequireRateLimiting("commands");
        userApi.MapPost("/{username}", (string username, UpdateUserInput input, UserStore users) => { users.Update(username, input); return Results.NoContent(); }).RequireRateLimiting("commands");
        if (!scalarCommands) return;
        var group = app.MapGroup("/api/v1/commands").RequireAuthorization();
        group.MapGet("/context", (string commandType, CommandService commands) => commands.Context(commandType));
        group.MapGet("", (CommandService commands) => commands.List());
        group.MapGet("/{id:guid}", (Guid id, CommandService commands) => commands.Get(id));
        group.MapPost("", (CommandRequest request, HttpContext c, CommandService commands) => Results.Ok(commands.Prepare(c.User.Identity!.Name!, request))).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
        group.MapPost("/{id:guid}/confirm", async (Guid id, Confirmation confirmation, HttpContext c, CommandService commands) => {
            if (!confirmation.Confirmed) throw new CommandRejected(422,"confirmation_required");
            return Results.Accepted($"/api/v1/commands/{id}", await commands.ConfirmAsync(c.User.Identity!.Name!, id));
        }).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
        group.MapPost("/{id:guid}/cancel", (Guid id, HttpContext c, CommandService commands) => Results.Ok(commands.Cancel(c.User.Identity!.Name!, id))).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
    }
}
public sealed class CommandWorker(CommandService commands, ILogger<CommandWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken token)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        while (await timer.WaitForNextTickAsync(token))
            try { commands.Tick(); }
            catch (CommandRejected) { logger.LogError("Command audit unavailable; commands disabled."); }
    }
}
