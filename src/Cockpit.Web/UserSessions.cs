using System.Security.Cryptography;
using System.Text;
using Cockpit.Application;
using Cockpit.Domain;
using Microsoft.Data.Sqlite;

public sealed partial class UserStore
{
    private static void InitializeSessions(SqliteConnection db)
    {
        using var command = db.CreateCommand();
        command.CommandText = "CREATE TABLE IF NOT EXISTS RememberedSessions (TokenHash TEXT PRIMARY KEY, Username TEXT NOT NULL, Version INTEGER NOT NULL, ExpiresUtc INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS IX_RememberedSessions_Expires ON RememberedSessions(ExpiresUtc)";
        command.ExecuteNonQuery();
    }
    private static string SessionHash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    public void RememberSession(string token, UserAccount account, DateTimeOffset expires, DateTimeOffset now)
    {
        lock (gate)
        {
            using var db = Open(); using var tx = db.BeginTransaction(); using var command = db.CreateCommand(); command.Transaction = tx;
            command.CommandText = "DELETE FROM RememberedSessions WHERE ExpiresUtc <= $now OR NOT EXISTS (SELECT 1 FROM Users WHERE Users.Username=RememberedSessions.Username AND Users.Version=RememberedSessions.Version AND Users.Disabled=0)";
            command.Parameters.AddWithValue("$now", now.ToUnixTimeSeconds()); command.ExecuteNonQuery();
            command.CommandText = "SELECT COUNT(*) FROM RememberedSessions";
            if ((long)command.ExecuteScalar()! >= 100) throw new CommandRejected(429, "session_limit");
            command.CommandText = "INSERT INTO RememberedSessions (TokenHash,Username,Version,ExpiresUtc) VALUES ($hash,$name,$version,$expires)";
            command.Parameters.AddWithValue("$hash", SessionHash(token)); command.Parameters.AddWithValue("$name", account.Username);
            command.Parameters.AddWithValue("$version", account.Version); command.Parameters.AddWithValue("$expires", expires.ToUnixTimeSeconds());
            command.ExecuteNonQuery(); tx.Commit();
        }
    }
    public bool ValidRememberedSession(string token, DateTimeOffset now)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT EXISTS(SELECT 1 FROM RememberedSessions s JOIN Users u ON u.Username=s.Username WHERE s.TokenHash=$hash AND s.ExpiresUtc>$now AND u.Disabled=0 AND u.Version=s.Version)";
        command.Parameters.AddWithValue("$hash", SessionHash(token)); command.Parameters.AddWithValue("$now", now.ToUnixTimeSeconds());
        return (long)command.ExecuteScalar()! != 0;
    }
    public void RevokeRememberedSession(string token)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM RememberedSessions WHERE TokenHash=$hash";
        command.Parameters.AddWithValue("$hash", SessionHash(token)); command.ExecuteNonQuery();
    }
}
