import { createTestUsers } from './test-user-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { chromium, request } from '@playwright/test';
const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(root, '.cache/operator-test-'));
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16);
const hash = ['pbkdf2-sha256','600000',salt.toString('base64'),pbkdf2Sync(password,salt,600000,32,'sha256').toString('base64')].join('$');
const dll = path.join(root,'src/Cockpit.Web/bin/'+(process.env.COCKPIT_TEST_CONFIGURATION || 'Debug')+'/net10.0/Cockpit.Web.dll');
let browser;
const processes = [];
async function port() { const server = net.createServer(); await new Promise(r => server.listen(0,'127.0.0.1',r)); const p=server.address().port; await new Promise(r=>server.close(r)); return p; }
async function start(name, extra={}) {
  const p=await port(); const fd=fs.openSync(path.join(work,name+'.log'),'w');
  const usersPath = path.join(work, name + '-users.db'); createTestUsers(usersPath, password);
  const env={...process.env, Source:'simulator', Simulator__Scenario:'normal', LocalPort:String(p), History__Path:path.join(work,name+'.db'), History__SampleSeconds:'5', Access__DatabasePath:usersPath, Access__RequireLogin:'false',
    LiveTest__Enabled:'false', HeatingCurve__Enabled:'false', LiveControl__Enabled:'true', LiveControl__Armed:'false', Control__Enabled:'false', Control__Outcome:'match', ...extra };
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

async function stop(child) { if(child.exitCode!==null || child.signalCode!==null)return; await new Promise(r=>{child.once('exit',r);child.kill();}); }
async function waitState(api,id,expected) { for(let i=0;i<100;i++){const r=await(await api.get('/api/v1/heating-curve/commands/'+id)).json();if(r.state===expected)return r;await new Promise(r=>setTimeout(r,250));}throw Error('Expected '+expected); }

try {
 const host=await start('settings',{LiveControl__Enabled:'false',Settings__Enabled:'true'});
 const api=await request.newContext({baseURL:host.origin});
 assert.ok([400,404].includes((await api.post('/api/v1/commands',{data:{}})).status()));
 let c=await(await api.get('/api/v1/settings')).json();assert.equal(c.values.retentionDays,700);
 const payload={...c.values,plantName:'Testanlage',retentionDays:600,confirmReduction:false};
 const unauth=await api.post('/api/v1/settings',{data:payload});assert.ok([400,401].includes(unauth.status()));
 const token=await login(api);const headers={'X-CSRF-TOKEN':token};
 assert.equal((await api.post('/api/v1/commands',{headers,data:{}})).status(),404);
 assert.equal((await api.post('/api/v1/settings',{data:payload})).status(),400);
 const viewer=await request.newContext({baseURL:host.origin});const vt=await login(viewer,'viewer');
 assert.equal((await viewer.post('/api/v1/settings',{headers:{'X-CSRF-TOKEN':vt},data:payload})).status(),403);
 assert.equal((await api.post('/api/v1/settings',{headers,data:payload})).status(),422);
 assert.equal((await api.post('/api/v1/settings',{headers,data:{...payload,retentionDays:701}})).status(),422);
 let r=await api.post('/api/v1/settings',{headers,data:{...payload,confirmReduction:true}});assert.equal(r.status(),200,await r.text());
 assert.equal((await api.post('/api/v1/settings',{headers,data:{...payload,confirmReduction:true}})).status(),409);
 c=await(await api.get('/api/v1/settings')).json();assert.equal(c.activeRetentionDays,700);assert.equal(c.restartRequired,true);
 assert.ok(!/password|hash|username|broker/i.test(JSON.stringify(c)));
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(host.origin);await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).waitFor();
 const heading=await page.getByRole('heading',{name:'Übersicht',exact:true}).boundingBox();
 const button=await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).boundingBox();
 assert.ok(button.x>heading.x+heading.width);assert.ok(button.y<heading.y+heading.height);
 await page.screenshot({path:path.join(work,'header-desktop.png')});
 await page.getByRole('button',{name:'Einstellungen',exact:true}).click();
 await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Anmelden',exact:true}).click();
 const name=page.getByLabel('Anlagenname',{exact:true});await name.waitFor();
 for(let i=0;i<50 && !(await name.isEnabled());i++)await page.waitForTimeout(100);
 await name.fill('Mein Cockpit');await page.getByLabel('Aufbewahrung in Tagen',{exact:true}).fill('700');
 await page.getByRole('button',{name:'Einstellungen speichern',exact:true}).click();
 await page.getByText('Einstellungen gespeichert.',{exact:false}).waitFor();
 await page.screenshot({path:path.join(work,'settings-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(work,'settings-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Übersicht',exact:true}).click();
 await page.screenshot({path:path.join(work,'header-mobile.png')});
 await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await api.dispose();await viewer.dispose();await stop(host.child);
 const restarted=await start('settings',{LiveControl__Enabled:'false',Settings__Enabled:'true'});
 c=await(await fetch(restarted.origin+'/api/v1/settings')).json();
 assert.equal(c.values.plantName,'Mein Cockpit');assert.equal(c.activeRetentionDays,700);assert.equal(c.restartRequired,false);
 assert.equal((await(await fetch(restarted.origin+'/api/v1/system')).json()).readOnly,true);


 const afterRestart=await request.newContext({baseURL:restarted.origin});
 const rt=await login(afterRestart);
 assert.equal((await afterRestart.post('/api/v1/settings',{headers:{'X-CSRF-TOKEN':rt},data:{...c.values,retentionDays:600,confirmReduction:true}})).status(),200);
 await afterRestart.dispose();await stop(restarted.child);
 const retentionHost=await start('settings',{LiveControl__Enabled:'false',Settings__Enabled:'true'});
 const retained=await(await fetch(retentionHost.origin+'/api/v1/settings')).json();
 assert.equal(retained.activeRetentionDays,600);assert.equal(retained.restartRequired,false);

 const layoutHost=await start('layout',{LiveControl__Enabled:'true'});
 await page.setViewportSize({width:1440,height:1100});await page.goto(layoutHost.origin);
 await page.getByRole('button',{name:'Steuerung',exact:true}).click();
 await page.locator('.control-page > .simulator-control').waitFor();
 const layoutBounds=await page.locator('.control-page').boundingBox();
 const controlBounds=await page.locator('.control-page > .simulator-control').boundingBox();
 const tileBounds=await page.locator('.control-status-grid').boundingBox();
 assert.ok(controlBounds.y>=tileBounds.y+tileBounds.height);
 assert.ok(Math.abs(controlBounds.width-layoutBounds.width)<1);
 assert.equal(await page.locator('.control-page > :last-child.simulator-control').count(),1);
 await page.screenshot({path:path.join(work,'control-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(work,'control-mobile.png'),fullPage:true});

 console.log('M4 settings: auth, roles, CSRF, validation, revision conflicts, retention confirmation, persistence, desktop/mobile header and UI passed. '+work);
} finally {if(browser)await browser.close();for(const p of processes)await stop(p);}
