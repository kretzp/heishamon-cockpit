import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { createTestUsers } from './test-user-fixture.mjs';

test('HTTPS with login is reachable via a non-loopback local address', { timeout: 60000 }, async () => {
  const address = Object.values(networkInterfaces()).flat().find(item => item?.family === 'IPv4' && !item.internal)?.address;
  assert.ok(address, 'A non-loopback IPv4 address is required for this test');
  const openssl = process.platform === 'win32' && existsSync('C:/Program Files/Git/usr/bin/openssl.exe') ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-network-')); mkdirSync(join(dir, 'data'));
  let child;
  const run = args => { const result = spawnSync(openssl, args, { cwd: dir, stdio: 'ignore' }); assert.equal(result.status, 0, `openssl failed: ${result.error ?? result.status}`); };
  const previousTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    cpSync(resolve('../src/Cockpit.Web/wwwroot'), join(dir, 'wwwroot'), { recursive: true });
    run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'key.pem', '-out', 'cert.pem', '-days', '1', '-subj', '/CN=localhost']);
    run(['pkcs12', '-export', '-out', 'data/localhost.pfx', '-inkey', 'key.pem', '-in', 'cert.pem', '-passout', 'pass:']);
    const users = join(dir, 'users.db'); const password = 'network-test-password'; createTestUsers(users, password);
    const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise(r => socket.close(r));
    const env = { ...process.env, Source: 'simulator', Simulator__Scenario: 'normal', Access__LocalHttps: 'true', Access__ListenAddress: '0.0.0.0', Access__RequireLogin: 'true', Access__DatabasePath: users, Settings__Enabled: 'true', LocalPort: String(port), History__Path: join(dir, 'history.db'), AllowedHosts: '*' };
    child = spawn('dotnet', [resolve('../src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll')], { cwd: dir, env, stdio: 'ignore', windowsHide: true });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Test-only self-signed certificate.
    const origin = `https://${address}:${port}`;
    for (let i = 0; i < 150; i++) { if (child.exitCode !== null) throw Error('Server exited'); try { if ((await fetch(origin + '/health/ready')).ok) break; } catch {} if (i === 149) throw Error('Server did not start'); await new Promise(r => setTimeout(r, 100)); }
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.equal((await fetch(origin + '/api/v1/system')).status, 401);
    const cookies = new Map(); let csrf = '';
    async function request(path, body) {
      const headers = { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') };
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-TOKEN'] = csrf; }
      const response = await fetch(origin + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); cookies.set(key, value); }
      return response;
    }
    csrf = (await (await request('/api/v1/auth/session')).json()).csrfToken;
    assert.equal((await request('/api/v1/auth/login', { username: 'operator', password })).status, 204);
    assert.equal((await request('/api/v1/system')).status, 200);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); }
    if (previousTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTls;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('network binding refuses configurations without HTTPS or login', () => {
  const assembly = resolve('../src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll');
  for (const [https, login] of [['false', 'true'], ['true', 'false']]) {
    const env = { ...process.env, Source: 'simulator', Access__ListenAddress: '0.0.0.0', Access__LocalHttps: https, Access__RequireLogin: login };
    const result = spawnSync('dotnet', [assembly], { env, encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Network access requires HTTPS and login/);
  }
});
