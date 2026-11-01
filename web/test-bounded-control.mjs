import { createTestUsers } from './test-user-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { chromium, request } from '@playwright/test';
const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(root, '.cache/m3b-test-'));
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16);
const hash = ['pbkdf2-sha256','600000',salt.toString('base64'),pbkdf2Sync(password,salt,600000,32,'sha256').toString('base64')].join('$');
const dll = path.join(root,'src/Cockpit.Web/bin/'+(process.env.COCKPIT_TEST_CONFIGURATION || 'M3Check')+'/net10.0/Cockpit.Web.dll');
let browser;
const processes = [];
async function port() { const server = net.createServer(); await new Promise(r => server.listen(0,'127.0.0.1',r)); const p=server.address().port; await new Promise(r=>server.close(r)); return p; }
async function start(name, extra={}) {
  const p=await port(); const fd=fs.openSync(path.join(work,name+'.log'),'w');
  const usersPath = path.join(work, name + '-users.db'); createTestUsers(usersPath, password);
  const env={...process.env, Source:'simulator', Simulator__Scenario:'normal', LocalPort:String(p), History__Path:path.join(work,name+'.db'), History__SampleSeconds:'5', Access__DatabasePath:usersPath, Access__RequireLogin:'false',
    LiveTest__Enabled:'false', Control__Enabled:'true', Control__Outcome:'match', ...extra };
  const child=spawn('dotnet',[dll],{cwd:path.join(root,'src/Cockpit.Web'),env,windowsHide:true,stdio:['ignore',fd,fd]});
  processes.push(child); child.on('exit',()=>fs.closeSync(fd));
  const origin='http://127.0.0.1:'+p;
  for(let i=0;i<100;i++){ if(child.exitCode!==null) throw new Error(name+' exited; see '+work); try { if((await fetch(origin+'/health/ready')).ok) return {origin,child}; }catch{} await new Promise(r=>setTimeout(r,100)); }
  throw new Error('Start timed out: '+name);
}
async function login(api, username='operator') {
  let session=await (await api.get('/api/v1/auth/session')).json();
  const response=await api.post('/api/v1/auth/login',{headers:{'X-CSRF-TOKEN':session.csrfToken},data:{username,password}});
  assert.equal(response.status(),204,await response.text());
  session=await (await api.get('/api/v1/auth/session')).json(); return session.csrfToken;
}
async function prepare(api,token,type,value) {
  const context=await (await api.get('/api/v1/commands/context?commandType='+type)).json(); assert.equal(context.available,true);
  const data={idempotencyKey:randomUUID(),commandType:type,desiredValue:value,expectedStateRevision:context.expectedStateRevision};
  const response=await api.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':token},data}); assert.equal(response.status(),200,await response.text());
  return {command:await response.json(),data};
}
async function state(api,id,expected) {
  for(let i=0;i<100;i++){ const c=await (await api.get('/api/v1/commands/'+id)).json(); if(c.state===expected)return c; await new Promise(r=>setTimeout(r,300)); } throw new Error('Expected '+expected);
}
async function stop(child) { if(child.exitCode!==null || child.signalCode!==null)return; await new Promise(r=>{child.once('exit',r);child.kill();}); }
try {
  // Reserve then close a local port: these HTTP/UI checks deliberately have no broker.
  // The real transport is covered separately by BoundedMqttTests with its own loopback broker.
  const brokerPort=await port();
  const config={Source:'mqtt',Control__Enabled:'false',LiveTest__Enabled:'true',LiveTest__Username:'isolated-writer',LiveTest__Password:password,
    LiveTest__ExpiresUtc:new Date(Date.now()+1800000).toISOString(),Mqtt__IsolatedTestBroker:'true',Mqtt__LiveReadOnly:'false',Mqtt__Host:'127.0.0.1',Mqtt__Port:String(brokerPort),Mqtt__Username:'isolated-reader'};
  const host=await start('bounded',config); const api=await request.newContext({baseURL:host.origin});
  const system=await (await api.get('/api/v1/system')).json();assert.equal(system.readOnly,false);assert.ok(system.capabilities.includes('boundedLiveTest'));
  assert.equal((await api.get('/api/v1/commands')).status(),401);
  assert.equal((await api.post('/api/v1/auth/login',{data:{username:'operator',password}})).status(),400);
  const token=await login(api);const context=await (await api.get('/api/v1/commands/context?commandType=setDhwTemperature')).json();
  assert.equal(context.source,'mqtt');assert.equal(context.available,false);assert.equal(context.minimum,51);assert.equal(context.maximum,52);assert.equal(context.timeoutSeconds,360);assert.equal(context.remainingSends,2);
  assert.equal((await api.get('/api/v1/commands/context?commandType=setDhwHeatDelta')).status(),403);
  const payload={idempotencyKey:randomUUID(),commandType:'setDhwTemperature',desiredValue:51,expectedStateRevision:context.expectedStateRevision};
  assert.equal((await api.post('/api/v1/commands',{data:payload})).status(),400);
  assert.equal((await api.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':token},data:payload})).status(),409);
  const viewer=await request.newContext({baseURL:host.origin}); const vt=await login(viewer,'viewer');
  assert.equal((await viewer.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':vt},data:payload})).status(),403);
  browser=await chromium.launch({headless:true});
  for(const mobile of [false,true]) {
    const ui=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});const page=await ui.newPage();
    await page.goto(host.origin);await page.getByRole('button',{name:'Steuerung',exact:true}).click();
    await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();
    await page.getByRole('button',{name:'Abmelden',exact:true}).waitFor();await page.getByText(/Verbleibende Sendeversuche: 2/).waitFor();
    assert.equal(await page.locator('#simulator-parameter option').count(),1);assert.equal(await page.getByRole('button',{name:'Änderung prüfen',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('heading',{name:'Begrenzter Live-Test',exact:true}).count(),1);
    // A browser-only API fixture verifies the confirmation wording without sending anything.
    const draft={id:'fixture',user:'operator',commandType:'setDhwTemperature',oldValue:52,desiredValue:51,observedValue:null,state:'validated',reason:'validated',updatedUtc:new Date().toISOString()};
    await page.route('**/api/v1/commands/context?*',r=>r.fulfill({json:{...context,available:true}}));
    await page.route('**/api/v1/commands',r=>r.fulfill({json:[draft]}));
    await page.getByRole('button',{name:'Jetzt an Wärmepumpe senden',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Jetzt an Wärmepumpe senden',exact:true}).isDisabled(),true);
    await page.getByLabel('Ich bestätige diese Änderung an der realen Wärmepumpe.').check();
    assert.equal(await page.getByRole('button',{name:'Jetzt an Wärmepumpe senden',exact:true}).isEnabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:path.join(work,mobile?'live-mobile.png':'live-desktop.png'),fullPage:false});await ui.close();
  }
  await api.dispose();await viewer.dispose();await stop(host.child);
  // Simulate the trusted loopback HTTPS proxy, still targeting only a loopback test port.
  const secure=await start('https-required',{...config,Mqtt__IsolatedTestBroker:'false',Mqtt__LiveReadOnly:'true',Mqtt__UseTls:'false'});
  const secureApi=await request.newContext({baseURL:secure.origin});
  assert.equal((await secureApi.get('/api/v1/auth/session')).status(),403);
  assert.equal((await secureApi.get('/api/v1/commands')).status(),403);
  const forwarded=await secureApi.get('/api/v1/auth/session',{headers:{'X-Forwarded-Proto':'https'}});assert.equal(forwarded.status(),200);
  assert.match(forwarded.headers()['set-cookie'],/secure/i);assert.match(forwarded.headers()['set-cookie'],/httponly/i);
  await secureApi.dispose();await stop(secure.child);
  for(const file of fs.readdirSync(work).filter(f=>f.endsWith('.log'))) { const log=fs.readFileSync(path.join(work,file),'utf8');assert.equal(log.includes(password),false);assert.equal(log.includes(hash),false); }
  console.log('M3b HTTP roles/CSRF, HTTPS guard, disconnected lockout and desktop/mobile labels passed. Artifacts: '+work);
} finally { if(browser)await browser.close();for(const child of processes)await stop(child); }
