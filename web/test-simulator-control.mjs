import { createTestUsers } from './test-user-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { chromium, request } from '@playwright/test';
const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(root, '.cache/m3a-test-'));
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
  const host=await start('match'); const api=await request.newContext({baseURL:host.origin});
  assert.equal((await api.get('/api/v1/commands')).status(),401);
  assert.equal((await api.post('/api/v1/commands',{headers:{'X-Role':'operator'},data:{}})).status(),401);
  assert.equal((await api.post('/api/v1/auth/login',{data:{username:'operator',password}})).status(),400);
  const token=await login(api);
  assert.equal((await api.post('/api/v1/commands',{data:{}})).status(),400);
  const viewer=await request.newContext({baseURL:host.origin}); const viewerToken=await login(viewer,'viewer');
  assert.equal((await viewer.get('/api/v1/commands')).status(),200);
  assert.equal((await viewer.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':viewerToken},data:{}})).status(),403);
  const {command,data}=await prepare(api,token,'setDhwHeatDelta',-6);
  const duplicate=await api.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':token},data}); assert.equal((await duplicate.json()).id,command.id);
  assert.equal((await api.post('/api/v1/commands/'+command.id+'/confirm',{headers:{'X-CSRF-TOKEN':token},data:{confirmed:false}})).status(),422);
  const confirm=()=>api.post('/api/v1/commands/'+command.id+'/confirm',{headers:{'X-CSRF-TOKEN':token},data:{confirmed:true}});
  assert.equal((await confirm()).status(),202); assert.equal((await confirm()).status(),202);
  assert.equal((await state(api,command.id,'observedMatchingState')).observedValue,-6);
  browser=await chromium.launch({headless:true});
  for(const mobile of [false,true]) {
    const uiHost=await start(mobile ? 'ui-mobile' : 'ui-desktop');
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage(); await page.goto(uiHost.origin); await page.getByRole('button',{name:'Steuerung',exact:true}).click();
    await page.getByLabel('Benutzername',{exact:true}).fill('operator'); await page.getByLabel('Passwort',{exact:true}).fill(password);
    await page.getByRole('button',{name:'Anmelden',exact:true}).click(); await page.getByRole('button',{name:'Abmelden',exact:true}).waitFor();
    await page.getByLabel('Parameter',{exact:true}).selectOption(mobile?'setDhwHeatDelta':'setDhwTemperature');
    await page.getByLabel(/Gewünschter Wert/).fill(mobile?'-6':'51');
    await page.getByRole('button',{name:'Änderung prüfen',exact:true}).click();
    const confirmButton=page.getByRole('button',{name:'Jetzt im Simulator bestätigen',exact:true});
    await confirmButton.waitFor(); assert.equal(await confirmButton.isDisabled(),true);
    await page.getByLabel('Ich bestätige diese Änderung im Simulator.').check();
    await confirmButton.click(); await page.getByText('Übereinstimmender Zustand beobachtet',{exact:true}).waitFor({timeout:20000});
    assert.equal(await page.getByRole('button',{name:'Jetzt im Simulator bestätigen'}).count(),0);
    await page.screenshot({path:path.join(work,mobile?'mobile.png':'desktop.png'),fullPage:false});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.getByRole('button',{name:'Abmelden',exact:true}).click(); await page.getByRole('button',{name:'Anmelden',exact:true}).waitFor();
    await context.close(); await stop(uiHost.child);
  }
  const copiedSession=await api.storageState();
  const badLogin=await api.post('/api/v1/auth/login',{headers:{'X-CSRF-TOKEN':token},data:{username:'operator',password:randomBytes(24).toString('hex')}}); assert.equal(badLogin.status(),401);
  let limited=false;
  for(let i=0;i<6;i++){ const r=await api.post('/api/v1/auth/login',{headers:{'X-CSRF-TOKEN':token},data:{username:'missing',password}}); if(r.status()===429)limited=true; }
  assert.equal(limited,true);
  await api.post('/api/v1/auth/logout',{headers:{'X-CSRF-TOKEN':token},data:{}});
  const replay=await request.newContext({baseURL:host.origin,storageState:copiedSession}); assert.equal((await replay.get('/api/v1/commands')).status(),401); await replay.dispose();
  assert.equal((await api.get('/api/v1/commands')).status(),401); await api.dispose(); await viewer.dispose(); await stop(host.child);
  const timeoutHost=await start('timeout',{Control__Outcome:'ignore'}); const timeoutApi=await request.newContext({baseURL:timeoutHost.origin}); const timeoutToken=await login(timeoutApi);
  const pending=await prepare(timeoutApi,timeoutToken,'setDhwTemperature',51);
  await timeoutApi.post('/api/v1/commands/'+pending.command.id+'/confirm',{headers:{'X-CSRF-TOKEN':timeoutToken},data:{confirmed:true}});
  await state(timeoutApi,pending.command.id,'timedOut'); await timeoutApi.dispose(); await stop(timeoutHost.child);
  const disabled=await start('disabled',{Control__Enabled:'false'}); const disabledApi=await request.newContext({baseURL:disabled.origin});
  assert.equal((await disabledApi.post('/api/v1/commands',{data:{}})).status(),404); assert.equal((await (await disabledApi.get('/api/v1/system')).json()).readOnly,true);
  await disabledApi.dispose(); await stop(disabled.child);
  const fd=fs.openSync(path.join(work,'mqtt-guard.log'),'w');
  const guard=spawn('dotnet',[dll],{cwd:path.join(root,'src/Cockpit.Web'),env:{...process.env,Source:'mqtt',Simulator__Scenario:'normal',Control__Enabled:'true',LocalPort:String(await port())},windowsHide:true,stdio:['ignore',fd,fd]});processes.push(guard);
  const code=await new Promise(r=>guard.once('exit',r));fs.closeSync(fd);assert.notEqual(code,0);assert.match(fs.readFileSync(path.join(work,'mqtt-guard.log'),'utf8'),/Simulator control requires/);
  for(const file of fs.readdirSync(work).filter(f=>f.endsWith('.log'))) { const log=fs.readFileSync(path.join(work,file),'utf8'); assert.equal(log.includes(password),false); assert.equal(log.includes(hash),false); }
  console.log('M3a HTTP security, readback, timeout, disabled/MQTT guards and desktop/mobile UI passed. Artifacts: '+work);
} finally { if(browser)await browser.close();for(const child of processes)await stop(child); }
