import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { chmodSync } from 'node:fs';

export function createTestUsers(path, password) {
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS Users (Username TEXT PRIMARY KEY COLLATE BINARY, Role TEXT NOT NULL, Disabled INTEGER NOT NULL, Salt BLOB NOT NULL, PasswordHash BLOB NOT NULL, Iterations INTEGER NOT NULL, Version INTEGER NOT NULL)');
  const insert = db.prepare('INSERT OR IGNORE INTO Users VALUES (?, ?, 0, ?, ?, 600000, 1)');
  for (const [name, role] of [['operator', 'admin'], ['viewer', 'reader']]) {
    const salt = randomBytes(16);
    insert.run(name, role, salt, pbkdf2Sync(password, salt, 600000, 32, 'sha256'));
  }
  db.close();
  if (process.platform !== 'win32') chmodSync(path, 0o600);
}
