using System.Text.Json;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.Data.Sqlite;

namespace Cockpit.Infrastructure.Persistence;

// Separate source-bound audit database; never modifies the M2 history schema.
public sealed class SqliteCurveJournal : ICurveJournal, IDisposable
{
    private readonly SqliteConnection db;
    private readonly FileStream writer;
    public SqliteCurveJournal(string path, string source = "simulator")
    {
        if (source is not ("simulator" or "mqtt")) throw new ArgumentException("Invalid audit source.");
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        writer = new FileStream(path + ".writer.lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString());
        try {
            db.Open();
            using var cmd = db.CreateCommand();
            cmd.CommandText = "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS Commands (Id TEXT PRIMARY KEY, Payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS CommandAudit (Sequence INTEGER PRIMARY KEY AUTOINCREMENT, CommandId TEXT NOT NULL, Payload TEXT NOT NULL);";
            cmd.ExecuteNonQuery();
            cmd.CommandText = "CREATE TABLE IF NOT EXISTS CommandMetadata (Id INTEGER PRIMARY KEY CHECK(Id=1), Source TEXT NOT NULL, FormatVersion INTEGER NOT NULL); INSERT OR IGNORE INTO CommandMetadata VALUES(1,$source,2); SELECT Source || ':' || FormatVersion FROM CommandMetadata WHERE Id=1;";
            cmd.Parameters.AddWithValue("$source",source);
            if (!Equals(cmd.ExecuteScalar(),source+":2")) throw new ArgumentException("Command audit source mismatch.");
        } catch { db.Dispose(); writer.Dispose(); throw; }
    }
    public IReadOnlyList<CurveRecord> Read()
    {
        using var cmd = db.CreateCommand(); cmd.CommandText = "SELECT Payload FROM Commands";
        using var reader = cmd.ExecuteReader(); var records = new List<CurveRecord>();
        while (reader.Read()) records.Add(JsonSerializer.Deserialize<CurveRecord>(reader.GetString(0))!);
        return records;
    }
    public void Save(CurveRecord record)
    {
        using var tx = db.BeginTransaction(); using var cmd = db.CreateCommand(); cmd.Transaction = tx;
        cmd.CommandText = "INSERT INTO Commands(Id,Payload) VALUES($id,$payload) ON CONFLICT(Id) DO UPDATE SET Payload=$payload; INSERT INTO CommandAudit(CommandId,Payload) VALUES($id,$payload);";
        cmd.Parameters.AddWithValue("$id", record.Id.ToString()); cmd.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(record));
        cmd.ExecuteNonQuery(); tx.Commit();
    }
    public void Dispose() { db.Dispose(); writer.Dispose(); }
}
