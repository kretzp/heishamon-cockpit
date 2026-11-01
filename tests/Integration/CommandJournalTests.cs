using Cockpit.Domain;
using Cockpit.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Xunit;
namespace Cockpit.Integration;
public sealed class CommandJournalTests
{
    [Fact] public void RestartReadsLatestAndKeepsEveryTransition()
    {
        var folder=Path.Combine(Path.GetTempPath(),"cockpit-command-"+Guid.NewGuid()); Directory.CreateDirectory(folder); var path=Path.Combine(folder,"audit.db");
        try {
            var now=DateTimeOffset.UtcNow; var c=new CommandRecord(Guid.NewGuid(),Guid.NewGuid(),"test","setDhwHeatDelta",-5,-6,null,"revision",CommandState.Draft,now,now,null,"draft");
            using(var journal=new SqliteCommandJournal(path)) { journal.Save(c); journal.Save(c with { State=CommandState.Validated }); Assert.Throws<IOException>(()=>new SqliteCommandJournal(path)); }
            using(var journal=new SqliteCommandJournal(path)) Assert.Equal(CommandState.Validated,Assert.Single(journal.Read()).State);
            using var db=new SqliteConnection(new SqliteConnectionStringBuilder { DataSource=path, Pooling=false }.ToString()); db.Open(); using var cmd=db.CreateCommand(); cmd.CommandText="SELECT COUNT(*) FROM CommandAudit"; Assert.Equal(2L,cmd.ExecuteScalar());
        } finally { Directory.Delete(folder,true); }
    }
}
