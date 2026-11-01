import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdtempSync, rmSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';

test('SQLite accounts enforce roles, CSRF, session revocation and last-admin protection', { timeout: 90000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-users-'));
  const dbPath = join(dir, 'users.db');
  const password = 'simulated-password-only';
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE Users (Username TEXT PRIMARY KEY COLLATE BINARY, Role TEXT NOT NULL, Disabled INTEGER NOT NULL, Salt BLOB NOT NULL, PasswordHash BLOB NOT NULL, Iterations INTEGER NOT NULL, Version INTEGER NOT NULL)');
  const salt = randomBytes(16);
  db.prepare('INSERT INTO Users VALUES (?, ?, 0, ?, ?, 600000, 1)').run('test-admin', 'admin', salt, pbkdf2Sync(password, salt, 600000, 32, 'sha256'));
  db.close();
  if (process.platform !== 'win32') chmodSync(dbPath, 0o600);
  const listener = createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r));
  const port = listener.address().port; await new Promise(r => listener.close(r));
  const env = { ...process.env, Source: 'simulator', Simulator__Scenario: 'normal', Access__RequireLogin: 'true', Access__DatabasePath: dbPath, Control__Enabled: 'true', Settings__Enabled: 'true', LocalPort: String(port), History__Path: join(dir, 'history.db') };
  const child = spawn('dotnet', [resolve('../src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll')], { cwd: resolve('../src/Cockpit.Web'), env, stdio: 'ignore', windowsHide: true });
  const base = `http://127.0.0.1:${port}`;
  function client() {
    const cookies = new Map(); let csrf = '';
    return { cookieHeader() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; '); }, async send(path, body, withCsrf = true) {
      const headers = {}; if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; if (withCsrf) headers['X-CSRF-TOKEN'] = csrf; }
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const cookie of response.headers.getSetCookie()) { const [name, value] = cookie.split(';')[0].split('='); cookies.set(name, value); }
      return response;
    }, async login(username, pass = password) { const before = await (await this.send('/api/v1/auth/session')).json(); csrf = before.csrfToken; const result = await this.send('/api/v1/auth/login', { username, password: pass }); if (result.ok) csrf = (await (await this.send('/api/v1/auth/session')).json()).csrfToken; return result; } };
  }
  let browser;
  try {
    for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw Error('Simulated server exited'); try { if ((await fetch(base + '/health/ready')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    const admin = client(), reader = client(), writer = client();
    assert.equal((await admin.login('test-admin')).status, 204);
    assert.equal((await admin.send('/api/v1/users', { username: 'test-reader', password, role: 'reader' }, false)).status, 400);
    for (const role of ['reader', 'writer']) assert.equal((await admin.send('/api/v1/users', { username: 'test-' + role, password, role })).status, 204);
    const accounts = await (await admin.send('/api/v1/users')).json();
    assert.equal(accounts.length, 3); assert.ok(accounts.every(account => !('passwordHash' in account) && !('salt' in account)));
    assert.equal((await reader.login('test-reader')).status, 204); assert.equal((await writer.login('test-writer')).status, 204);
    assert.equal((await reader.send('/api/v1/users')).status, 403);
    assert.equal((await writer.send('/api/v1/users')).status, 403);
    assert.equal((await reader.send('/api/v1/settings/mqtt')).status, 403);
    assert.equal((await writer.send('/api/v1/settings/mqtt')).status, 403);
    const broker = await (await admin.send('/api/v1/settings/mqtt')).json();
    const changedBroker = { host: 'example.invalid', port: 8883, prefix: 'simulated', useTls: true, credentialAction: 'replace', username: 'simulated-user', password: 'simulated-broker-password', revision: broker.revision };
    assert.equal((await admin.send('/api/v1/settings/mqtt', changedBroker, false)).status, 400);
    const savedBroker = await admin.send('/api/v1/settings/mqtt', changedBroker); assert.equal(savedBroker.status, 200);
    const savedText = await savedBroker.text(); assert.ok(!savedText.includes('simulated-user') && !savedText.includes('simulated-broker-password'));
    assert.ok(!readFileSync(join(dir, 'mqtt-secrets', 'mqtt.protected'), 'utf8').includes('simulated-broker-password'));
    assert.equal((await admin.send('/api/v1/settings/mqtt', changedBroker)).status, 409);
    assert.equal((await reader.send('/api/v1/settings', {})).status, 403);
    assert.equal((await writer.send('/api/v1/settings', {})).status, 403);
    const request = { idempotencyKey: crypto.randomUUID(), commandType: 'setDhwHeatDelta', desiredValue: -8, expectedStateRevision: 0 };
    assert.equal((await reader.send('/api/v1/commands', request)).status, 403);
    assert.notEqual((await writer.send('/api/v1/commands', request)).status, 403);
    assert.equal((await admin.send('/api/v1/users/test-admin', { role: 'reader', disabled: false, password: null, expectedVersion: 1 })).status, 409);
    assert.equal((await admin.send('/api/v1/users/test-writer', { role: 'reader', disabled: false, password: null, expectedVersion: 1 })).status, 204);
    assert.equal((await admin.send('/api/v1/users/test-writer', { role: 'writer', disabled: false, password: null, expectedVersion: 1 })).status, 409);
    assert.equal((await writer.send('/api/v1/snapshot')).status, 401);
    const hub = new HubConnectionBuilder().withUrl(base + '/hubs/telemetry', { headers: { Cookie: reader.cookieHeader() }, transport: HttpTransportType.WebSockets }).configureLogging(LogLevel.None).build();
    await hub.start();
    let closeHub; const closed = new Promise(resolve => { closeHub = resolve; }); hub.onclose(closeHub);
    assert.equal((await admin.send('/api/v1/users/test-reader', { role: 'reader', disabled: true, password: null, expectedVersion: 1 })).status, 204);
    assert.equal((await reader.send('/api/v1/snapshot')).status, 401);
    await Promise.race([closed, new Promise((_, reject) => setTimeout(() => reject(Error('revoked SignalR session remained connected')), 5000))]);
    assert.equal((await admin.send('/api/v1/users/test-reader', { role: 'reader', disabled: false, password: 'another-simulated-password', expectedVersion: 2 })).status, 204);
    assert.equal((await client().login('test-reader', 'another-simulated-password')).status, 204);
    assert.equal((await client().send('/api/v1/snapshot')).status, 401);
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const page = await browser.newPage(); await page.goto(base);
    await page.getByLabel('Benutzername', { exact: true }).fill('test-admin');
    await page.getByLabel('Passwort', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
    for (const [language, title] of [['de', 'Benutzerverwaltung'], ['en', 'User administration'], ['fr', 'Gestion des utilisateurs'], ['es', 'Administración de usuarios'], ['it', 'Gestione utenti'], ['pt', 'Gestão de utilizadores']]) {
      await page.getByTestId('language-picker').selectOption(language);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
    }
    await page.getByTestId('language-picker').selectOption('de');
    await page.getByLabel('HeishaMon-Topic-Basis').fill('fixture/heishamon');
    await page.getByRole('button', { name: 'Broker-Einstellungen speichern' }).click();
    await page.getByText('Broker-Einstellungen gespeichert.', { exact: true }).waitFor();
    await page.getByLabel('Benutzername', { exact: true }).fill('ui-reader');
    await page.getByLabel('Passwort', { exact: true }).fill('another-simulated-password');
    await page.getByRole('button', { name: 'Benutzer anlegen' }).click();
    await page.getByText('Benutzer angelegt.', { exact: true }).waitFor();
    assert.equal((await (await admin.send('/api/v1/users')).json()).some(u => u.username === 'ui-reader'), true);
    await page.getByLabel('Rolle für ui-reader').selectOption('writer');
    await page.getByLabel('Deaktivieren ui-reader').check();
    await page.getByLabel('Neues Passwort für ui-reader (leer lassen, um das Passwort beizubehalten)').fill('reset-simulated-password');
    await page.getByRole('button', { name: 'Speichern ui-reader' }).click();
    await page.getByText('Benutzer aktualisiert.', { exact: true }).waitFor();
    const edited = (await (await admin.send('/api/v1/users')).json()).find(u => u.username === 'ui-reader');
    assert.equal(edited.role, 'writer'); assert.equal(edited.disabled, true); assert.equal(edited.version, 2);
    await page.getByLabel('Rolle für test-admin').selectOption('reader');
    await page.getByRole('button', { name: 'Speichern test-admin' }).click();
    await page.getByText('Der letzte aktive Administrator kann nicht deaktiviert oder herabgestuft werden.').waitFor();
  } finally {
    if (browser) await browser.close();
    child.kill(); await new Promise(r => child.once('exit', r)); rmSync(dir, { recursive: true, force: true });
  }
});
