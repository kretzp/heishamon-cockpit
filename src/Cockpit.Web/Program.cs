using System.Text.Json.Serialization;
using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;
using Cockpit.Infrastructure.Persistence;
using Cockpit.Simulator;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
var localPort = builder.Configuration.GetValue("LocalPort", 5080);
if (localPort is < 1024 or > 65535) throw new ArgumentException("Invalid local HTTP port.");
var localHttps = builder.Configuration.GetValue<bool>("Access:LocalHttps");
var listenAddress = builder.Configuration["Access:ListenAddress"] ?? (localHttps ? "0.0.0.0" : "localhost");
var loopbackOnly = listenAddress == "localhost" || System.Net.IPAddress.TryParse(listenAddress, out var parsedLoopback) && System.Net.IPAddress.IsLoopback(parsedLoopback);
if (!loopbackOnly && (!localHttps || !builder.Configuration.GetValue("Access:RequireLogin", true)))
    throw new ArgumentException("Network access requires HTTPS and login.");
if (listenAddress != "localhost" && !System.Net.IPAddress.TryParse(listenAddress, out _))
    throw new ArgumentException("Listen address must be localhost or an IP address.");
builder.WebHost.ConfigureKestrel(options => {
    void Configure(Microsoft.AspNetCore.Server.Kestrel.Core.ListenOptions endpoint) {
    if (localHttps) endpoint.UseHttps(System.Security.Cryptography.X509Certificates.X509CertificateLoader.LoadPkcs12FromFile(
        Path.Combine(builder.Environment.ContentRootPath, "data", "localhost.pfx"), ""));
    }
    if (listenAddress == "localhost") options.ListenLocalhost(localPort, Configure);
    else options.Listen(System.Net.IPAddress.Parse(listenAddress), localPort, Configure);
});
var source = builder.Configuration["Source"] ?? "simulator";
if (source is not ("simulator" or "mqtt")) throw new ArgumentException("Invalid telemetry source.");
var scenario = builder.Configuration["Simulator:Scenario"] ?? "cycle";
if (!SimulatorSource.Scenarios.Contains(scenario)) throw new ArgumentException("Invalid simulator scenario.");
var controlEnabled = builder.Configuration.GetValue<bool>("Control:Enabled");
if (controlEnabled && (source != "simulator" || scenario != "normal"))
    throw new ArgumentException("Simulator control requires Source=simulator and Simulator:Scenario=normal.");
var historyPath = builder.Configuration["History:Path"] ?? Path.Combine("data", source + ".db");
if (!Path.IsPathRooted(historyPath)) historyPath = Path.Combine(builder.Environment.ContentRootPath, historyPath);
var usersPath = builder.Configuration["Access:DatabasePath"] ?? Path.Combine(Path.GetDirectoryName(historyPath)!, "users.db");
if (!Path.IsPathRooted(usersPath)) usersPath = Path.Combine(builder.Environment.ContentRootPath, usersPath);
var mqttSecretDirectory = builder.Configuration["Mqtt:SecretDirectory"] ?? Path.Combine(Path.GetDirectoryName(usersPath)!, "mqtt-secrets");
var mqttSettings = new MqttSettingsStore(mqttSecretDirectory, builder.Configuration.GetSection("Mqtt").Get<MqttReadOptions>() ?? new());
var readOptions = mqttSettings.Read().Options;
if (args.Contains("--setup-installation", StringComparer.Ordinal))
{
    InstallationSetup.Run(builder.Environment.ContentRootPath, usersPath, mqttSettings);
    return;
}
var controlSetup = new ControlSetupStore(historyPath + ".control.json");
var pendingControl = controlSetup.Read();
var liveTest = builder.Configuration.GetSection("LiveTest").Get<LiveTestOptions>() ?? new();
if (liveTest.Enabled && (controlEnabled || source != "mqtt")) throw new ArgumentException("Live test requires MQTT and disabled simulator control.");
if (liveTest.Enabled) liveTest.Validate(readOptions, DateTimeOffset.UtcNow);
var curveOptions = builder.Configuration.GetSection("HeatingCurve").Get<CurveControlOptions>() ?? new();
if (curveOptions.Enabled && (controlEnabled || liveTest.Enabled || source == "simulator" && scenario != "normal"))
    throw new ArgumentException("Heating curve control requires an exclusive command mode and normal simulator.");
if (curveOptions.Enabled && source == "mqtt") curveOptions.Validate(readOptions, DateTimeOffset.UtcNow);
// Permanent operator mode is explicit and separate from both historical test modes.
var externalLiveControl = builder.Configuration.GetValue<bool>("LiveControl:Enabled");
var externalMode = externalLiveControl || controlEnabled || liveTest.Enabled || curveOptions.Enabled;
var dynamicMode = !externalMode && builder.Configuration.GetValue("Access:RequireLogin", true);
var confirmedControl = !externalMode && pendingControl.Enabled && pendingControl.BrokerBinding == ControlSetupStore.Binding(source, readOptions);
var liveControl = externalLiveControl || confirmedControl && !dynamicMode;
if (confirmedControl && source == "simulator") scenario = "normal";
if (liveControl) {
    if (controlEnabled || liveTest.Enabled || curveOptions.Enabled) throw new ArgumentException("LiveControl requires disabled historical command modes.");
    if (source == "simulator" && scenario != "normal") throw new ArgumentException("Combined simulator requires normal scenario.");
    if (source == "mqtt" && !confirmedControl && (!builder.Configuration.GetValue<bool>("LiveControl:ProfileConfirmed") || !builder.Configuration.GetValue<bool>("LiveControl:AllowSharedCredentials")))
        throw new ArgumentException("LiveControl requires confirmed profile and shared credential opt-in.");
    curveOptions = new CurveControlOptions { Enabled=true, Continuous=true, ScalarCommands=true, SterilizationEnabled=true, ExtendedControlsEnabled=true, ProfileConfirmed=true, ConnectionEnabled=confirmedControl || builder.Configuration.GetValue<bool>("LiveControl:Armed"),
        AllowSharedCredentials=true, Username=readOptions.Username, Password=readOptions.Password };
    if (source == "mqtt") curveOptions.Validate(readOptions,DateTimeOffset.UtcNow);
}
var commandsEnabled = controlEnabled || liveTest.Enabled || curveOptions.Enabled;
var settingsEnabled = builder.Configuration.GetValue<bool>("Settings:Enabled") || liveControl;
var loginRequired = builder.Configuration.GetValue("Access:RequireLogin", true);
if (!loginRequired && source != "simulator") throw new ArgumentException("Login is required for MQTT sources.");
var authenticationEnabled = loginRequired || commandsEnabled || settingsEnabled;
builder.Services.AddSingleton(new TelemetryAudience(loginRequired));
var coordinator = new CommandCoordinator();
var requireControlHttps = authenticationEnabled && (!loopbackOnly || builder.Configuration.GetValue<bool>("Access:RequireHttps") || source == "mqtt" && !readOptions.IsolatedTestBroker);
builder.Services.Configure<ForwardedHeadersOptions>(o => { o.ForwardedHeaders = ForwardedHeaders.XForwardedProto; o.ForwardLimit = 1; });
var outcome = builder.Configuration["Control:Outcome"] ?? "match";
if (outcome is not ("match" or "ignore" or "wrong" or "fail")) throw new ArgumentException("Invalid simulator command outcome.");
var simulator = new SimulatorSource(scenario, controlEnabled || curveOptions.Enabled, outcome, dynamicMode ? () => controlSetup.Read().Enabled : null);
var policy = builder.Configuration.GetSection("Telemetry").Get<TelemetryPolicy>() ?? new();
policy.Validate();
var store = new TelemetryStore(source == "simulator" ? SourceKind.Simulator : SourceKind.Mqtt, policy);
var dynamicControl = dynamicMode ? new DynamicControl(source, controlSetup, mqttSettings, simulator, store, coordinator) : null;
builder.Services.AddSingleton(store);
var historyPolicy = builder.Configuration.GetSection("History").Get<HistoryPolicy>() ?? new();
historyPolicy.Validate();
if (args.Contains("--create-initial-admin", StringComparer.Ordinal))
{
    var users = new UserStore(usersPath);
    Console.Write("Administrator username: ");
    var username = Console.ReadLine() ?? "";
    Console.Write("Administrator password: ");
    var password = new System.Text.StringBuilder();
    while (true) { var key = Console.ReadKey(true); if (key.Key == ConsoleKey.Enter) break; if (key.Key == ConsoleKey.Backspace) { if (password.Length > 0) password.Length--; } else if (!char.IsControl(key.KeyChar)) password.Append(key.KeyChar); }
    Console.WriteLine();
    users.CreateInitialAdmin(username, password.ToString());
    Console.WriteLine("Initial administrator created.");
    return;
}
if (authenticationEnabled)
{
    var users = new UserStore(usersPath);
    if (!users.HasUsers()) throw new InvalidOperationException("Create the initial administrator using --create-initial-admin before starting.");
    builder.Services.AddSingleton(users);
}
var settings = new AppSettingsStore(historyPath + ".settings.json", historyPolicy.RetentionDays);
historyPolicy = historyPolicy with { RetentionDays = settings.Read().RetentionDays };
builder.Services.AddSingleton(settings);
builder.Services.AddSingleton(mqttSettings);
builder.Services.AddSingleton(controlSetup);
builder.Services.AddSingleton<IHistoryStore>(_ => new SqliteHistoryStore(historyPath,
    source == "simulator" ? SourceKind.Simulator : SourceKind.Mqtt, historyPolicy));
builder.Services.AddSingleton<HistoryWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<HistoryWorker>());
builder.Services.AddSingleton<IReadOnlyTelemetrySource>(source == "simulator"
    ? simulator
    : new ReloadingMqttSource(mqttSettings));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase)));
builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase)));
builder.Services.AddHostedService<TelemetryWorker>();
if (authenticationEnabled) builder.Services.AddSimulatorAuthentication(builder.Configuration, localPort, requireControlHttps);
if (dynamicControl is not null)
{
    builder.Services.AddSingleton(dynamicControl);
    builder.Services.AddHostedService(sp => sp.GetRequiredService<DynamicControl>());
    builder.Services.AddSingleton<ICommandJournal>(_ => new SqliteCommandJournal(historyPath + ".operator-commands.db", source));
    builder.Services.AddSingleton<ICurveJournal>(_ => new SqliteCurveJournal(historyPath + ".curve-commands.db", source));
    builder.Services.AddSingleton(new CommandPolicy(ContinuousMqtt: source == "mqtt", SterilizationEnabled: true, ExtendedControlsEnabled: true));
    builder.Services.AddSingleton(sp => new CommandService(store, sp.GetRequiredService<ICommandJournal>(), dynamicControl, sp.GetRequiredService<CommandPolicy>(), coordinator: coordinator));
    builder.Services.AddSingleton(sp => new CurveService(store, source, sp.GetRequiredService<ICurveJournal>(), dynamicControl, coordinator: coordinator));
    builder.Services.AddHostedService<CommandWorker>();
    builder.Services.AddHostedService<CurveWorker>();
}
else if (commandsEnabled)
{

    if (!curveOptions.Enabled || liveControl) {
    builder.Services.AddSingleton<ICommandJournal>(_ => new SqliteCommandJournal(historyPath + (liveControl ? ".operator-commands.db" : ".commands.db"), source));
    builder.Services.AddSingleton<ISimulatorCommands>(simulator);
    builder.Services.AddSingleton(new CommandPolicy(liveTest.Enabled,liveTest.ExpiresUtc,liveControl && source == "mqtt", SterilizationEnabled:liveControl, ExtendedControlsEnabled:liveControl));
    if (liveTest.Enabled)
    {
        builder.Services.AddSingleton(new MqttLiveTestTransport(readOptions,liveTest));
        builder.Services.AddSingleton<ICommandTransport>(sp => sp.GetRequiredService<MqttLiveTestTransport>());
        builder.Services.AddHostedService<LiveTestConnectionWorker>();
    }
    else if (liveControl && source == "mqtt") builder.Services.AddSingleton<ICommandTransport>(sp => sp.GetRequiredService<MqttCurveTransport>());
    else builder.Services.AddSingleton<ICommandTransport>(new SimulatorCommandTransport(simulator));
    builder.Services.AddSingleton(sp => new CommandService(store,sp.GetRequiredService<ICommandJournal>(),sp.GetRequiredService<ICommandTransport>(),sp.GetRequiredService<CommandPolicy>(),coordinator:coordinator));
    builder.Services.AddHostedService<CommandWorker>();
    }
}
if (dynamicControl is not null) { }
else if (curveOptions.Enabled) {
    builder.Services.AddSingleton<ICurveJournal>(_ => new SqliteCurveJournal(historyPath + ".curve-commands.db", source));
    if (source == "mqtt") {
        builder.Services.AddSingleton(new MqttCurveTransport(readOptions,curveOptions));
        builder.Services.AddSingleton<ICurveTransport>(sp => sp.GetRequiredService<MqttCurveTransport>());
        builder.Services.AddHostedService<CurveConnectionWorker>();
    } else builder.Services.AddSingleton<ICurveTransport>(new SimulatorCurveTransport(simulator));
    builder.Services.AddSingleton(sp => new CurveService(store,source,sp.GetRequiredService<ICurveJournal>(),sp.GetRequiredService<ICurveTransport>(),source == "mqtt" ? curveOptions.ExpiresUtc : null,coordinator:coordinator));
    builder.Services.AddHostedService<CurveWorker>();
} else builder.Services.AddSingleton(new CurveService(store,source));
var app = builder.Build();
if (requireControlHttps) app.UseForwardedHeaders();
if (authenticationEnabled) app.MapSimulatorControl(requireControlHttps, dynamicControl is not null || commandsEnabled && (!curveOptions.Enabled || liveControl), loginRequired);
else app.MapGet("/api/v1/auth/session", () => Results.Ok(new { loginRequired = false, authenticated = false }));
// The replacement proxy must fail closed against older or unprotected hosts.
app.MapGet("/api/v1/auth/access-mode", () => loginRequired ? Results.NoContent() : Results.StatusCode(503));
if (loginRequired) app.Use(async (context, next) => {
    var path = context.Request.Path;
    if ((path.StartsWithSegments("/api") && !path.StartsWithSegments("/api/v1/auth") || path.StartsWithSegments("/hubs"))
        && context.User.Identity?.IsAuthenticated != true) {
        context.Response.StatusCode = 401;
        context.Response.Headers.CacheControl = "no-store";
        return;
    }
    await next(context);
});
app.MapSettings(settingsEnabled, historyPolicy, source);
if (authenticationEnabled) {
    app.MapMqttSettings(source == "mqtt" && commandsEnabled, source);
    app.MapControlSetup(source, liveControl, externalMode, dynamicControl);
}
app.MapHeatingCurve(dynamicControl is not null || curveOptions.Enabled);
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Content-Security-Policy"] = $"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws://localhost:{localPort} ws://127.0.0.1:{localPort} wss:; frame-ancestors 'none'; base-uri 'self'";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/api/v1/system", () => new
{
    appVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version!.ToString(3), plantName = settings.Read().PlantName, settingsEnabled, source, capabilities = new[] { "snapshot", "liveTelemetry", "history", "events", "csv" }.Concat(liveControl || dynamicControl?.Active == true ? new[] { source == "mqtt" ? "liveCommands" : "simulatorCommands", "heatingCurveCommands", "sterilizationCommands", "extendedCommands" } : controlEnabled ? new[] { "simulatorCommands" } : liveTest.Enabled ? new[] { "boundedLiveTest" } : curveOptions.Enabled ? new[] { "heatingCurveCommands" } : Array.Empty<string>()),
    liveControlArmed = dynamicControl?.Active ?? (liveControl && (source == "simulator" || curveOptions.ConnectionEnabled)), readOnly = !(commandsEnabled || dynamicControl?.Active == true), instanceId = store.InstanceId
});
app.MapGet("/api/v1/snapshot", () => store.Read());
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));
// Configuration and DI are initialized at this point; device reachability is not readiness.
app.MapGet("/health/ready", () => Results.Ok(new { status = "ready" }));
app.MapHistory();
var telemetryHub = app.MapHub<TelemetryHub>("/hubs/telemetry", options => options.CloseOnAuthenticationExpiration = true);
if (loginRequired) telemetryHub.RequireAuthorization();
app.Run();

public sealed class TelemetryAudience(bool protectedAccess)
{
    public bool Protected { get; } = protectedAccess;
    public System.Collections.Concurrent.ConcurrentDictionary<string, HubCallerContext> Connections { get; } = new();
}
public sealed class TelemetryHub(TelemetryAudience audience) : Hub
{
    public override Task OnConnectedAsync() { audience.Connections[Context.ConnectionId] = Context; return base.OnConnectedAsync(); }
    public override Task OnDisconnectedAsync(Exception? exception) { audience.Connections.TryRemove(Context.ConnectionId, out _); return base.OnDisconnectedAsync(exception); }
}
public sealed class TelemetryWorker(IReadOnlyTelemetrySource source, TelemetryStore store, IHubContext<TelemetryHub> hub, TelemetryAudience audience, IServiceProvider services) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.WhenAll(source.RunAsync(store, stoppingToken), Broadcast(stoppingToken));
    }

    private async Task Broadcast(CancellationToken token)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(token))
        {
            if (!audience.Protected) { await hub.Clients.All.SendAsync("SnapshotChanged", store.Read(), token); continue; }
            var users = services.GetRequiredService<SimulatorUsers>();
            foreach (var (id, connection) in audience.Connections) {
                if (!users.Valid(connection.User?.FindFirst("sid")?.Value)) { connection.Abort(); continue; }
                await hub.Clients.Client(id).SendAsync("SnapshotChanged", store.Read(), token);
            }
        }
    }
}

public sealed class LiveTestConnectionWorker(MqttLiveTestTransport transport) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken token) => transport.RunAsync(token);
}
