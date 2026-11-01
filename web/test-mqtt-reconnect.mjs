import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createTestUsers } from './test-user-fixture.mjs';

// Minimal, isolated MQTT test brokers: acknowledge CONNECT and SUBSCRIBE only.
async function broker() {
  const topics = [], connections = new Set(), publishes = [];
  const server = createServer(socket => {
    connections.add(socket); socket.on('close', () => connections.delete(socket));
    socket.on('error', () => {});
    let buffered = Buffer.alloc(0), version = 4;
    socket.on('data', data => {
      buffered = Buffer.concat([buffered, data]);
      while (buffered.length >= 2) {
        let remaining = 0, multiplier = 1, pos = 1, digit;
        do { if (pos >= buffered.length) return; digit = buffered[pos++]; remaining += (digit & 127) * multiplier; multiplier *= 128; } while (digit & 128);
        if (buffered.length < pos + remaining) return;
        const kind = buffered[0] >> 4, body = buffered.subarray(pos, pos + remaining); buffered = buffered.subarray(pos + remaining);
        if (kind === 1) { version = body[6]; socket.write(Buffer.from(version === 5 ? [0x20, 3, 0, 0, 0] : [0x20, 2, 0, 0])); }
        if (kind === 8) {
          const id = body.subarray(0, 2); let offset = 2;
          if (version === 5) { let n = 0, mult = 1, d; do { d = body[offset++]; n += (d & 127) * mult; mult *= 128; } while (d & 128); offset += n; }
          let count = 0; while (offset < body.length) { const len = body.readUInt16BE(offset); offset += 2; topics.push(body.subarray(offset, offset + len).toString()); offset += len + 1; count++; }
          const payload = Buffer.concat([id, version === 5 ? Buffer.from([0]) : Buffer.alloc(0), Buffer.alloc(count)]);
          socket.write(Buffer.concat([Buffer.from([0x90, payload.length]), payload]));
        }
        if (kind === 3) publishes.push(body);
        if (kind === 12) socket.write(Buffer.from([0xd0, 0]));
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, topics, connections, publishes, async close() { for (const socket of connections) socket.destroy(); await new Promise(r => server.close(r)); } };
}
async function until(check) { for (let i = 0; i < 200; i++) { if (check()) return; await new Promise(r => setTimeout(r, 50)); } throw Error('Timed out waiting for local MQTT state'); }

test('changing the HeishaMon topic base reconnects to the selected isolated broker', { timeout: 45000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-mqtt-')), a = await broker(), b = await broker();
  const password = 'simulated-test-password'; const users = join(dir, 'users.db'); createTestUsers(users, password);
  const portHolder = createServer(); await new Promise(r => portHolder.listen(0, '127.0.0.1', r)); const webPort = portHolder.address().port; await new Promise(r => portHolder.close(r));
  const env = { ...process.env, Source: 'mqtt', Settings__Enabled: 'true', LocalPort: String(webPort), Access__RequireLogin: 'true', Access__DatabasePath: users, History__Path: join(dir, 'history.db'), Mqtt__Host: '127.0.0.1', Mqtt__Port: String(a.port), Mqtt__Prefix: 'fixture/first', Mqtt__IsolatedTestBroker: 'true', Mqtt__UseTls: 'false' };
  const start = () => spawn('dotnet', [resolve('../src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll')], { cwd: resolve('../src/Cockpit.Web'), env, stdio: 'ignore', windowsHide: true });
  let child = start();
  const origin = `http://127.0.0.1:${webPort}`; const cookies = new Map(); let csrf;
  async function request(path, body) {
    const headers = { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-TOKEN'] = csrf; }
    const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const item of response.headers.getSetCookie()) { const [k, v] = item.split(';')[0].split('='); cookies.set(k, v); }
    return response;
  }
  try {
    await until(() => a.topics.includes('fixture/first/main/Pump_Flow'));
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/health/ready')).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
    csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    assert.equal((await request('/api/v1/auth/login', { username: 'operator', password })).status, 204);
    csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    const config = await (await request('/api/v1/settings/mqtt')).json();
    const response = await request('/api/v1/settings/mqtt', { host: '127.0.0.1', port: b.port, prefix: 'fixture/second', useTls: false, credentialAction: 'replace', username: 'fixture-broker-user', password: 'fixture-broker-password', revision: config.revision });
    assert.equal(response.status, 200);
    await until(() => b.topics.includes('fixture/second/main/Pump_Flow') && a.connections.size === 0);
    assert.ok(b.topics.every(topic => topic.startsWith('fixture/second/')));
    child.kill(); await new Promise(r => child.once('exit', r));
    await until(() => b.connections.size === 0); b.topics.length = 0;
    child = start();
    await until(() => b.topics.includes('fixture/second/main/Pump_Flow'));
    assert.equal(a.connections.size, 0);
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/health/ready')).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
    cookies.clear(); csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    assert.equal((await request('/api/v1/auth/login', { username: 'operator', password })).status, 204);
    csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    let control = await (await request('/api/v1/settings/control')).json();
    const enable = { enabled: true, profile: 'aquarea-l-wh-wdg', confirmProfile: true, confirmNoOtherWriters: true, confirmSharedCredentials: true, revision: control.revision };
    assert.equal((await request('/api/v1/settings/control', { ...enable, confirmSharedCredentials: false })).status, 422);
    assert.equal((await request('/api/v1/settings/control', enable)).status, 200);
    control = await (await request('/api/v1/settings/control')).json();
    assert.equal(control.active, true); assert.equal(control.restartRequired, false);
    await until(() => b.connections.size >= 2);
    assert.equal((await (await request('/api/v1/system')).json()).liveControlArmed, true);
    const currentBroker = await (await request('/api/v1/settings/mqtt')).json();
    assert.equal((await request('/api/v1/settings/mqtt', { host: '127.0.0.1', port: a.port, prefix: 'fixture/third', useTls: false, credentialAction: 'keep', revision: currentBroker.revision })).status, 409);
    assert.equal(b.publishes.length, 0);
    child.kill(); await new Promise(r => child.once('exit', r)); await until(() => b.connections.size === 0); b.topics.length = 0;
    child = start(); await until(() => b.connections.size >= 2 && b.topics.includes('fixture/second/main/Pump_Flow'));
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/health/ready')).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
    cookies.clear(); csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    assert.equal((await request('/api/v1/auth/login', { username: 'operator', password })).status, 204);
    const system = await (await request('/api/v1/system')).json(); assert.equal(system.liveControlArmed, true); assert.ok(system.capabilities.includes('liveCommands'));
    const command = await (await request('/api/v1/commands/context?commandType=setDhwHeatDelta')).json(); assert.equal(command.available, false);
    await new Promise(r => setTimeout(r, 500)); assert.equal(b.publishes.length, 0);
    csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    control = await (await request('/api/v1/settings/control')).json();
    assert.equal((await request('/api/v1/settings/control', { enabled: false, profile: null, confirmProfile: false, confirmNoOtherWriters: false, confirmSharedCredentials: false, revision: control.revision })).status, 200);
    assert.equal((await (await request('/api/v1/system')).json()).readOnly, true);
    await until(() => b.connections.size === 1);
    assert.equal(b.publishes.length, 0);
  } finally {
    child.kill(); if (child.exitCode === null && child.signalCode === null) await new Promise(r => child.once('exit', r));
    await a.close(); await b.close(); rmSync(dir, { recursive: true, force: true });
  }
});
