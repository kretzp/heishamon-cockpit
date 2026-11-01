namespace Cockpit.Application;

// Configuration transitions and sends share the same asynchronous exclusion gate.
public sealed class ControlSendGate
{
    private readonly SemaphoreSlim gate = new(1, 1);
    public async Task<T> RunAsync<T>(Func<Task<T>> action)
    {
        await gate.WaitAsync();
        try { return await action(); }
        finally { gate.Release(); }
    }
    public Task RunAsync(Func<Task> action) => RunAsync(async () => { await action(); return true; });
}
