using Cockpit.Domain;
namespace Cockpit.Application;

// Shared reservation lasts from draft through readback, across both command APIs.
public sealed class CommandCoordinator
{
    private readonly object gate = new();
    private Guid? owner;
    private string? family;
    private bool faulted;
    public bool HasPending { get { lock (gate) return owner is not null; } }
    public bool BlockedFor(string caller) { lock (gate) return faulted || owner is not null && family != caller; }
    public void Acquire(Guid id, string caller)
    {
        lock (gate)
        {
            if (faulted) throw new CommandRejected(503, "audit_unavailable");
            if (owner is not null && owner != id) throw new CommandRejected(409, "command_pending");
            owner = id; family = caller;
        }
    }
    public void Release(Guid id) { lock (gate) if (owner == id) { owner = null; family = null; } }
    public void Fault() { lock (gate) faulted = true; }
}
