using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Cockpit.Domain;
namespace Cockpit.Application;

public interface ICurveJournal { IReadOnlyList<CurveRecord> Read(); void Save(CurveRecord record); }
public interface ICurveTransport { bool Connected { get; } long ConnectionEpoch { get; } Task SendAsync(string part, CurveValues values); }
public sealed class SimulatorCurveTransport(ISimulatorCommands simulator) : ICurveTransport
{
    public bool Connected => true;
    public long ConnectionEpoch => 0;
    public Task SendAsync(string part,CurveValues values) {
        _=HeatingCurve.Payload(part,values);
        for(var i=0;i<HeatingCurve.Fields.Count;i++) if(HeatingCurve.Fields[i].Part==part) simulator.SetValue(HeatingCurve.Fields[i].Key,values.Numbers[i]);
        return Task.CompletedTask;
    }
}

public sealed class CurveService
{
    private readonly object gate=new();
    private readonly SemaphoreSlim ticking=new(1,1);
    private readonly TelemetryStore telemetry;
    private readonly ICurveJournal? journal;
    private readonly ICurveTransport? transport;
    private readonly TimeProvider clock;
    private readonly string source;
    private readonly DateTimeOffset? expires;
    private readonly Dictionary<Guid,CurveRecord> records;
    private bool faulted;
    private readonly CommandCoordinator coordinator;
    private static readonly string[] Guards=["heatingControlMode","zonesState","operatingMode","activeError"];
    private int Timeout => source=="mqtt"?360:20;
    private static bool Open(CurveRecord r)=>r.State is CurveState.Validated or CurveState.Running;
    private T Locked<T>(Func<T> run) { lock(gate) return telemetry.Guarded(run); }
    public CurveService(TelemetryStore telemetry, string source, ICurveJournal? journal=null, ICurveTransport? transport=null, DateTimeOffset? expires=null, TimeProvider? clock=null, CommandCoordinator? coordinator=null)
    {
        this.coordinator=coordinator??new();
        this.telemetry=telemetry;this.source=source;this.journal=journal;this.transport=transport;this.expires=expires;this.clock=clock??TimeProvider.System;
        records=journal?.Read().ToDictionary(r=>r.Id)??[];
        if(records.Values.Any(r=>r.Source!=source)) throw new ArgumentException("Curve audit source mismatch.");
        foreach(var r in records.Values.Where(Open).ToArray()) Finish(r,CurveState.Cancelled,"restart");
    }
    private string Hash(Snapshot s,bool guardsOnly=false) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
        telemetry.InstanceId,telemetry.ConnectionEpoch,WriterEpoch=transport?.ConnectionEpoch,
        Values=s.Values.Where(v=>Guards.Contains(v.Key)||!guardsOnly&&HeatingCurve.Fields.Any(f=>f.Key==v.Key)).Select(v=>new {v.Key,v.Value,v.Quality,v.Retained})
    }))));
    private bool Fresh(TelemetryValue v)=>v.Quality==Quality.Valid&&!v.Retained&&v.SourceKind==(source=="mqtt"?SourceKind.Mqtt:SourceKind.Simulator);
    private string Blocked(Snapshot s)
    {
        if(journal is null||transport is null) return "read_only";
        if(faulted) return "audit_unavailable";
        if(coordinator.BlockedFor("curve")) return "command_pending";
        if(expires is not null&&clock.GetUtcNow()>=expires) return "window_closed";
        if(!transport.Connected||!s.BrokerConnected||s.DeviceAvailability!=Availability.Online) return "offline";
        if(s.Values.Where(v=>Guards.Contains(v.Key)||HeatingCurve.Fields.Any(f=>f.Key==v.Key)).Any(v=>!Fresh(v))) return "state_unavailable";
        object? V(string key)=>s.Values.Single(v=>v.Key==key).Value;
        if(V("heatingControlMode") is not int mode||mode!=0) return "not_compensation";
        if(V("zonesState") is not int zones||zones is not(0 or 2)) return "zone1_inactive";
        if(V("operatingMode") is not int operating||operating is not(0 or 2 or 4 or 6)) return "not_heating";
        if(!Equals(V("activeError"),Catalog.NoError)) return "device_error";
        var values=HeatingCurve.Read(s);
        return values is null||HeatingCurve.Validate(values).Count>0?"state_unavailable":"";
    }
    public CurveContext Context()=>Locked(()=> {var s=telemetry.Read();var reason=Blocked(s);if(reason==""&&records.Values.Any(Open))reason="command_pending";return new CurveContext(Hash(s),HeatingCurve.Read(s),HeatingCurve.Fields,reason=="",reason,Timeout,source);});
    public IReadOnlyList<CurveRecord> List()=>Locked(()=>records.Values.OrderByDescending(r=>r.CreatedUtc).Take(100).ToArray());
    public CurveRecord Get(Guid id)=>Locked(()=>records.GetValueOrDefault(id)??throw new CommandRejected(404,"not_found"));
    private CurveRecord Save(CurveRecord r)
    {
        if(faulted||journal is null)throw new CommandRejected(503,"audit_unavailable");
        if(Open(r))coordinator.Acquire(r.Id,"curve");
        try { journal.Save(r);records[r.Id]=r;if(!Open(r))coordinator.Release(r.Id);return r; } catch {coordinator.Fault();faulted=true;throw new CommandRejected(503,"audit_unavailable");}
    }
    private void Check(Snapshot s,string revision) {
        var reason=Blocked(s);if(reason!="")throw new CommandRejected(409,reason);
        if(Hash(s)!=revision)throw new CommandRejected(409,"state_conflict");
    }
    public CurveRecord Prepare(string user,CurveRequest request)=>Locked(()=> {
        if(request.Desired is null||HeatingCurve.Validate(request.Desired).Count>0||request.IdempotencyKey==Guid.Empty)throw new CommandRejected(422,"invalid_curve");
        var old=records.Values.SingleOrDefault(r=>r.IdempotencyKey==request.IdempotencyKey);
        if(old is not null) {
            if(old.User!=user||old.Desired!=request.Desired||old.ExpectedStateRevision!=request.ExpectedStateRevision)throw new CommandRejected(409,"idempotency_conflict");
            return old;
        }
        var s=telemetry.Read();Check(s,request.ExpectedStateRevision);
        if(records.Values.Any(Open))throw new CommandRejected(409,"command_pending");
        if(records.Values.Any(r=>r.Parts.Any(p=>p.SentUtc>clock.GetUtcNow().AddSeconds(-30))))throw new CommandRejected(429,"cooldown");
        var current=HeatingCurve.Read(s)!;
        var parts=new[]{"curve","delta","cutoff"}.Where(part=>HeatingCurve.Fields.Select((f,i)=>(f,i)).Any(x=>x.f.Part==part&&current.Numbers[x.i]!=request.Desired.Numbers[x.i])).Select(part=>new CurvePart(part,CurvePartState.Pending)).ToArray();
        if(parts.Length==0)throw new CommandRejected(422,"unchanged");
        var now=clock.GetUtcNow();return Save(new(Guid.NewGuid(),request.IdempotencyKey,user,source,current,request.Desired,request.ExpectedStateRevision,Hash(s,true),CurveState.Validated,now,now,parts,Observe(s)));
    });
    private static IReadOnlyList<TelemetryValue> Observe(Snapshot s)=>s.Values.Where(v=>HeatingCurve.Fields.Any(f=>f.Key==v.Key)).ToArray();
    private CurveRecord Owned(string user,Guid id) {var r=Get(id);if(r.User!=user)throw new CommandRejected(403,"not_owner");return r;}
    public CurveRecord Confirm(string user,Guid id)=>Locked(()=> {
        var r=Owned(user,id);if(r.State!=CurveState.Validated)return r;
        if(clock.GetUtcNow()-r.CreatedUtc>=TimeSpan.FromSeconds(60))return Finish(r,CurveState.Cancelled,"draft_expired");
        Check(telemetry.Read(),r.ExpectedStateRevision);
        return Save(r with { State=CurveState.Running,UpdatedUtc=clock.GetUtcNow() });
    });
    public CurveRecord Cancel(string user,Guid id)=>Locked(()=> {var r=Owned(user,id);if(r.State!=CurveState.Validated)throw new CommandRejected(409,"already_started");return Finish(r,CurveState.Cancelled,"user_cancelled");});
    private CurveRecord Finish(CurveRecord r,CurveState state,string reason)=>Save(r with {
        State=state,Reason=reason,UpdatedUtc=clock.GetUtcNow(),Observed=Observe(telemetry.Read()),
        Parts=r.Parts.Select(p=>p.State==CurvePartState.Pending?p with {State=CurvePartState.Skipped,Reason=reason}:p.State is CurvePartState.Sending or CurvePartState.Waiting?p with {State=CurvePartState.Cancelled,Reason=reason}:p).ToArray()
    });
    private CurveRecord SetPart(CurveRecord r,int i,CurvePart part)=>Save(r with {Parts=r.Parts.Select((p,index)=>index==i?part:p).ToArray(),UpdatedUtc=clock.GetUtcNow(),Observed=Observe(telemetry.Read())});
    private CurveState FailureState(CurveRecord r,CurveState otherwise)=>r.Parts.Any(p=>p.State==CurvePartState.ObservedMatchingState)?CurveState.Partial:otherwise;
    // Single worker; network I/O never holds the telemetry lock. Persist send intent before publishing.
    public async Task TickAsync()
    {
        if(!await ticking.WaitAsync(0))return;
        try {
            (Guid Id,int Index,CurveValues Desired)? send=Locked<(Guid Id,int Index,CurveValues Desired)?>(()=> {
                var r=records.Values.SingleOrDefault(Open);if(r is null||faulted)return null;
                if(r.State==CurveState.Validated) {if(clock.GetUtcNow()-r.CreatedUtc>=TimeSpan.FromSeconds(60))Finish(r,CurveState.Cancelled,"draft_expired");return null;}
                var s=telemetry.Read();var reason=Blocked(s);
                if(reason!=""||Hash(s,true)!=r.GuardRevision) {Finish(r,FailureState(r,CurveState.Cancelled),reason!=""?reason:"state_conflict");return null;}
                var i=r.Parts.ToList().FindIndex(p=>p.State is CurvePartState.Waiting or CurvePartState.Pending);
                if(i<0)return null;
                var part=r.Parts[i];var current=HeatingCurve.Read(s)!;
                // Other groups must stay unchanged or at their already observed requested value.
                for(var n=0;n<HeatingCurve.Fields.Count;n++) {
                    var group=HeatingCurve.Fields[n].Part;
                    if(group==part.Name&&part.State==CurvePartState.Waiting)continue;
                    var matched=r.Parts.Any(p=>p.Name==group&&p.State==CurvePartState.ObservedMatchingState);
                    if(current.Numbers[n]!=(matched?r.Desired:r.OldValues).Numbers[n]) {Finish(r,FailureState(r,CurveState.Cancelled),"state_conflict");return null;}
                }
                if(part.State==CurvePartState.Waiting) {
                    bool matches=HeatingCurve.Fields.Select((f,n)=>(f,n)).Where(x=>x.f.Part==part.Name).All(x=>current.Numbers[x.n]==r.Desired.Numbers[x.n]&&s.Values.Single(v=>v.Key==x.f.Key).ReceivedAtUtc>=part.SentUtc!.Value.AddSeconds(10));
                    if(matches) {
                        r=SetPart(r,i,part with {State=CurvePartState.ObservedMatchingState});
                        if(r.Parts.All(p=>p.State==CurvePartState.ObservedMatchingState))Finish(r,CurveState.ObservedMatchingState,"matching_values_observed");
                    } else if(clock.GetUtcNow()-part.SentUtc>=TimeSpan.FromSeconds(Timeout)) {
                        r=SetPart(r,i,part with {State=CurvePartState.TimedOut,Reason="readback_timeout"});Finish(r,FailureState(r,CurveState.TimedOut),"readback_timeout");
                    }
                    return null;
                }
                SetPart(r,i,part with {State=CurvePartState.Sending,SentUtc=clock.GetUtcNow()});
                return (r.Id,i,r.Desired);
            });
            if(send is not {} job)return;
            try {
                var r=Get(job.Id);await transport!.SendAsync(r.Parts[job.Index].Name,job.Desired);
                Locked(()=>SetPart(Get(job.Id),job.Index,Get(job.Id).Parts[job.Index] with {State=CurvePartState.Waiting}));
            } catch(CommandRejected e) when(e.Code=="audit_unavailable") {throw;}
            catch {
                Locked(()=> {var r=Get(job.Id);r=SetPart(r,job.Index,r.Parts[job.Index] with {State=CurvePartState.Failed,Reason="delivery_unknown"});return Finish(r,FailureState(r,CurveState.Failed),"delivery_unknown");});
            }
        } finally {ticking.Release();}
    }
}
