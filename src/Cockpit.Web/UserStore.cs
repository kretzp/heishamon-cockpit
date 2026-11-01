using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using Cockpit.Application;
using Cockpit.Domain;

public sealed record UserAccount(string Username, string Role, bool Disabled, long Version);
public sealed record CreateUserInput(string Username, string Password, string Role);
public sealed record UpdateUserInput(string Role, bool Disabled, string? Password, long ExpectedVersion);

// A separate database keeps accounts independent of the telemetry source.
public sealed class UserStore
{
    private const int Iterations = 600000;
    private readonly string connectionString;
    private readonly object gate = new();
    private static readonly byte[] DummySalt = new byte[16];
    public UserStore(string path)
    {
        path = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (!OperatingSystem.IsWindows())
        {
            try { using var file = new FileStream(path, new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite }); }
            catch (IOException) when (File.Exists(path)) { }
            var mode = File.GetUnixFileMode(path);
            if ((mode & (UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute | UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute)) != 0)
                throw new InvalidOperationException("The account database must be accessible only to its owner.");
        }
        connectionString = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "CREATE TABLE IF NOT EXISTS Users (Username TEXT PRIMARY KEY COLLATE BINARY, Role TEXT NOT NULL, Disabled INTEGER NOT NULL, Salt BLOB NOT NULL, PasswordHash BLOB NOT NULL, Iterations INTEGER NOT NULL, Version INTEGER NOT NULL)";
        command.ExecuteNonQuery();
    }
    private SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    private static void Validate(string username, string role, string? password)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 64 || username.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not ('.' or '_' or '-'))
            || role is not ("admin" or "reader" or "writer")
            || password is not null && (password.Length is < 12 or > 128))
            throw new CommandRejected(422, "invalid_user");
    }
    private static byte[] Hash(string password, byte[] salt, int iterations) => Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32);
    public bool HasUsers() { using var db = Open(); using var c = db.CreateCommand(); c.CommandText = "SELECT EXISTS(SELECT 1 FROM Users)"; return (long)c.ExecuteScalar()! != 0; }
    public void CreateInitialAdmin(string username, string password)
    {
        Validate(username, "admin", password);
        var salt = RandomNumberGenerator.GetBytes(16); var hash = Hash(password, salt, Iterations);
        lock (gate)
        {
            using var db = Open(); using var c = db.CreateCommand();
            c.CommandText = "INSERT INTO Users SELECT $name,'admin',0,$salt,$hash,$iterations,1 WHERE NOT EXISTS (SELECT 1 FROM Users)";
            c.Parameters.AddWithValue("$name", username); c.Parameters.AddWithValue("$salt", salt); c.Parameters.AddWithValue("$hash", hash); c.Parameters.AddWithValue("$iterations", Iterations);
            if (c.ExecuteNonQuery() != 1) throw new CommandRejected(409, "setup_complete");
        }
    }
    public void Create(string username, string password, string role)
    {
        Validate(username, role, password); if (password is null) throw new CommandRejected(422, "invalid_user");
        var salt = RandomNumberGenerator.GetBytes(16); var hash = Hash(password, salt, Iterations);
        lock (gate)
        {
            using var db = Open(); using var c = db.CreateCommand();
            c.CommandText = "INSERT OR IGNORE INTO Users VALUES ($name,$role,0,$salt,$hash,$iterations,1)";
            c.Parameters.AddWithValue("$name", username); c.Parameters.AddWithValue("$role", role); c.Parameters.AddWithValue("$salt", salt); c.Parameters.AddWithValue("$hash", hash); c.Parameters.AddWithValue("$iterations", Iterations);
            if (c.ExecuteNonQuery() != 1) throw new CommandRejected(409, "user_exists");
        }
    }
    public UserAccount? Verify(string username, string password)
    {
        if (username is null || password is null || username.Length > 64 || password.Length is < 12 or > 128) return null;
        using var db = Open(); using var c = db.CreateCommand(); c.CommandText = "SELECT Role,Disabled,Salt,PasswordHash,Iterations,Version FROM Users WHERE Username=$name"; c.Parameters.AddWithValue("$name", username);
        using var r = c.ExecuteReader(); var exists = r.Read();
        var salt = exists ? (byte[])r[2] : DummySalt; var expected = exists ? (byte[])r[3] : new byte[32]; var count = exists ? r.GetInt32(4) : Iterations;
        var valid = CryptographicOperations.FixedTimeEquals(Hash(password, salt, count), expected);
        return valid && exists && r.GetInt64(1) == 0 ? new(username, r.GetString(0), false, r.GetInt64(5)) : null;
    }
    public UserAccount? Find(string username)
    {
        using var db = Open(); using var c = db.CreateCommand(); c.CommandText = "SELECT Role,Disabled,Version FROM Users WHERE Username=$name"; c.Parameters.AddWithValue("$name", username);
        using var r = c.ExecuteReader(); return r.Read() ? new(username, r.GetString(0), r.GetInt64(1) != 0, r.GetInt64(2)) : null;
    }
    public IReadOnlyList<UserAccount> List()
    {
        using var db = Open(); using var c = db.CreateCommand(); c.CommandText = "SELECT Username,Role,Disabled,Version FROM Users ORDER BY Username";
        using var r = c.ExecuteReader(); var result = new List<UserAccount>(); while (r.Read()) result.Add(new(r.GetString(0), r.GetString(1), r.GetInt64(2) != 0, r.GetInt64(3))); return result;
    }
    public void Update(string username, UpdateUserInput input)
    {
        Validate(username, input.Role, input.Password);
        if (input.ExpectedVersion < 1) throw new CommandRejected(422, "invalid_user_version");
        lock (gate)
        {
            using var db = Open(); using var tx = db.BeginTransaction(); using var c = db.CreateCommand(); c.Transaction = tx;
            c.CommandText = "SELECT Role,Disabled,Version FROM Users WHERE Username=$name"; c.Parameters.AddWithValue("$name", username);
            using var r = c.ExecuteReader(); if (!r.Read()) throw new CommandRejected(404, "user_not_found"); var wasAdmin = r.GetString(0) == "admin" && r.GetInt64(1) == 0; var version = r.GetInt64(2); r.Close();
            if (version != input.ExpectedVersion) throw new CommandRejected(409, "user_conflict");
            if (wasAdmin && (input.Disabled || input.Role != "admin")) { c.CommandText = "SELECT COUNT(*) FROM Users WHERE Role='admin' AND Disabled=0"; if ((long)c.ExecuteScalar()! <= 1) throw new CommandRejected(409, "last_admin"); }
            c.CommandText = input.Password is null ? "UPDATE Users SET Role=$role,Disabled=$disabled,Version=Version+1 WHERE Username=$name" : "UPDATE Users SET Role=$role,Disabled=$disabled,Version=Version+1,Salt=$salt,PasswordHash=$hash,Iterations=$iterations WHERE Username=$name";
            c.Parameters.AddWithValue("$role", input.Role); c.Parameters.AddWithValue("$disabled", input.Disabled ? 1 : 0);
            if (input.Password is not null) { var salt = RandomNumberGenerator.GetBytes(16); c.Parameters.AddWithValue("$salt", salt); c.Parameters.AddWithValue("$hash", Hash(input.Password, salt, Iterations)); c.Parameters.AddWithValue("$iterations", Iterations); }
            c.ExecuteNonQuery(); tx.Commit();
        }
    }
}
