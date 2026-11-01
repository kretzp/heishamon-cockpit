import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createTestUsers } from './test-user-fixture.mjs';

test('admin changes control immediately and writer controls only the simulator', { timeout: 90000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-control-'));
  const users = join(dir, 'users.db'); const password = 'simulated-password-only'; createTestUsers(users, password);
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  const env = { ...process.env, Source: 'simulator', Simulator__Scenario: 'normal', Access__RequireLogin: 'true', Access__DatabasePath: users, Settings__Enabled: 'true', Control__Enabled: 'false', LiveControl__Enabled: 'false', LocalPort: String(port), History__Path: join(dir, 'history.db') };
  const origin = `http://127.0.0.1:${port}`;
  let child; let browser;
  async function start() {
    child = spawn('dotnet', [resolve('../src/Cockpit.Web/bin/Debug/net10.0/Cockpit.Web.dll')], { cwd: resolve('../src/Cockpit.Web'), env, stdio: 'ignore', windowsHide: true });
    for (let i=0; i<150; i++) { if (child.exitCode !== null) throw Error('Simulator exited'); try { if ((await fetch(origin+'/health/ready')).ok) return; } catch {} await new Promise(r=>setTimeout(r,100)); }
    throw Error('Simulator did not start');
  }
  async function stop() { if (child && child.exitCode === null && child.signalCode === null) { child.kill(); await new Promise(r=>child.once('exit',r)); } }
  function client() {
    const cookies = new Map(); let csrf = '';
    return { async send(path, body, withCsrf=true) {
      const headers={}; if(cookies.size)headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
      if(body!==undefined){headers['Content-Type']='application/json';if(withCsrf)headers['X-CSRF-TOKEN']=csrf;}
      const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
      for(const cookie of response.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');cookies.set(k,v);}return response;
    }, async login(name) {csrf=(await (await this.send('/api/v1/auth/session')).json()).csrfToken;const r=await this.send('/api/v1/auth/login',{username:name,password});if(r.ok)csrf=(await (await this.send('/api/v1/auth/session')).json()).csrfToken;return r;} };
  }
  try {
    await start(); let admin=client(), reader=client(), writer=client();
    assert.equal((await admin.login('operator')).status,204);assert.equal((await reader.login('viewer')).status,204);
    assert.equal((await admin.send('/api/v1/users',{username:'test-writer',password,role:'writer'})).status,204);assert.equal((await writer.login('test-writer')).status,204);
    assert.equal((await reader.send('/api/v1/settings/control')).status,403);assert.equal((await writer.send('/api/v1/settings/control')).status,403);
    let state=await (await admin.send('/api/v1/settings/control')).json();assert.equal(state.active,false);assert.equal(state.enabled,false);
    const selection={enabled:true,profile:'aquarea-l-wh-wdg',confirmProfile:true,confirmNoOtherWriters:true,confirmSharedCredentials:false,revision:state.revision};
    assert.equal((await admin.send('/api/v1/settings/control',selection,false)).status,400);
    assert.equal((await admin.send('/api/v1/settings/control',{...selection,confirmProfile:false})).status,422);
    assert.equal((await admin.send('/api/v1/settings/control',{...selection,profile:'unsupported'})).status,422);
    assert.equal((await writer.send('/api/v1/settings/control',selection)).status,403);
    browser=await chromium.launch({channel:'chromium',headless:true});const page=await browser.newPage();await page.goto(origin);
    await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
    await page.getByLabel('Steuerungsmodus').selectOption('enabled');await page.getByLabel('Geräteprofil').selectOption('aquarea-l-wh-wdg');
    await page.getByLabel('Ich habe geprüft, dass Wärmepumpe und Installation diesem Profil entsprechen.').check();
    await page.getByLabel('Ich habe andere Steuerungen geprüft und vermeide widersprüchliche Änderungen.').check();
    await page.getByRole('button',{name:'Steuerungseinstellungen speichern'}).click();await page.getByText('Steuerungseinstellungen gespeichert.').waitFor();
    state=await (await admin.send('/api/v1/settings/control')).json();assert.equal(state.enabled,true);assert.equal(state.active,true);assert.equal(state.restartRequired,false);
    const system=await (await admin.send('/api/v1/system')).json();assert.equal(system.source,'simulator');assert.ok(system.capabilities.includes('simulatorCommands'));
    await browser.close();browser=null;
    let context;for(let i=0;i<100;i++){context=await(await writer.send('/api/v1/commands/context?commandType=setDhwHeatDelta')).json();if(context.available)break;await new Promise(r=>setTimeout(r,100));}assert.equal(context.available,true);
    const oldDraft=await (await writer.send('/api/v1/commands',{idempotencyKey:randomUUID(),commandType:'setDhwHeatDelta',desiredValue:-8,expectedStateRevision:context.expectedStateRevision})).json();
    assert.equal((await admin.send('/api/v1/settings/control',{enabled:false,profile:null,confirmProfile:false,confirmNoOtherWriters:false,confirmSharedCredentials:false,revision:state.revision})).status,200);
    assert.equal((await writer.send('/api/v1/commands/'+oldDraft.id+'/confirm',{confirmed:true})).status,409);
    state=await (await admin.send('/api/v1/settings/control')).json();
    assert.equal((await admin.send('/api/v1/settings/control',{...selection,revision:state.revision})).status,200);
    state=await (await admin.send('/api/v1/settings/control')).json();
    for(let i=0;i<100;i++){context=await(await writer.send('/api/v1/commands/context?commandType=setDhwHeatDelta')).json();if(context.available)break;await new Promise(r=>setTimeout(r,100));}assert.equal(context.available,true);
    const prepared=await writer.send('/api/v1/commands',{idempotencyKey:randomUUID(),commandType:'setDhwHeatDelta',desiredValue:-8,expectedStateRevision:context.expectedStateRevision});assert.equal(prepared.status,200);const command=await prepared.json();
    assert.equal((await writer.send('/api/v1/commands/'+command.id+'/confirm',{confirmed:false})).status,422);
    assert.equal((await writer.send('/api/v1/commands/'+command.id+'/confirm',{confirmed:true})).status,202);
    for(let i=0;i<100;i++){const r=await(await writer.send('/api/v1/commands/'+command.id)).json();if(r.state==='observedMatchingState')break;if(i===99)throw Error('Simulated command was not observed');await new Promise(r=>setTimeout(r,100));}
    assert.equal((await admin.send('/api/v1/settings/control',{enabled:false,profile:null,confirmProfile:false,confirmNoOtherWriters:false,confirmSharedCredentials:false,revision:state.revision})).status,200);
    assert.equal((await(await admin.send('/api/v1/settings/control')).json()).active,false);
    assert.equal((await(await admin.send('/api/v1/system')).json()).readOnly,true);
    assert.equal((await(await writer.send('/api/v1/commands/context?commandType=setDhwHeatDelta')).json()).available,false);
  } finally { if(browser)await browser.close();await stop();rmSync(dir,{recursive:true,force:true}); }
});
