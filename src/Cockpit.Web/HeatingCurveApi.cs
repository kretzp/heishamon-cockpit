using Cockpit.Application;
using Cockpit.Domain;
using Cockpit.Infrastructure;
public static class HeatingCurveApi
{
    public static void MapHeatingCurve(this WebApplication app,bool enabled)
    {
        app.MapGet("/api/v1/heating-curve/context",(CurveService curves)=>curves.Context());
        if(!enabled)return;
        var group=app.MapGroup("/api/v1/heating-curve/commands").RequireAuthorization();
        group.MapGet("",(CurveService curves)=>curves.List());
        group.MapGet("/{id:guid}",(Guid id,CurveService curves)=>curves.Get(id));
        group.MapPost("",(CurveRequest request,HttpContext c,CurveService curves)=>curves.Prepare(c.User.Identity!.Name!,request)).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
        group.MapPost("/{id:guid}/confirm",(Guid id,Confirmation confirmation,HttpContext c,CurveService curves)=> {
            if(!confirmation.Confirmed)throw new CommandRejected(422,"confirmation_required");
            return Results.Accepted($"/api/v1/heating-curve/commands/{id}",curves.Confirm(c.User.Identity!.Name!,id));
        }).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
        group.MapPost("/{id:guid}/cancel",(Guid id,HttpContext c,CurveService curves)=>curves.Cancel(c.User.Identity!.Name!,id)).RequireAuthorization("simulator-operator").RequireRateLimiting("commands");
    }
}
public sealed class CurveWorker(CurveService curves,ILogger<CurveWorker> logger):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken token) {
        using var timer=new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        while(await timer.WaitForNextTickAsync(token))try {await curves.TickAsync();}catch(CommandRejected){logger.LogError("Heating curve audit unavailable; commands disabled.");}
    }
}
public sealed class CurveConnectionWorker(MqttCurveTransport transport):BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken token)=>transport.RunAsync(token);
}
