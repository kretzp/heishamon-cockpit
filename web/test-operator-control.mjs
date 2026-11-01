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
 const host=await start('combined');const api=await request.newContext({baseURL:host.origin});
 const system=await(await api.get('/api/v1/system')).json();assert.equal(system.appVersion,'0.8.3');assert.ok(system.capabilities.includes('heatingCurveCommands'));assert.ok(system.capabilities.includes('simulatorCommands'));
 assert.equal((await api.get('/api/v1/commands')).status(),401);assert.equal((await api.get('/api/v1/heating-curve/commands')).status(),401);
 const token=await login(api);const headers={'X-CSRF-TOKEN':token};
 const sc=await(await api.get('/api/v1/commands/context?commandType=setDhwHeatDelta')).json();
 const scalar={idempotencyKey:randomUUID(),commandType:'setDhwHeatDelta',desiredValue:-8,expectedStateRevision:sc.expectedStateRevision};
 assert.equal((await api.post('/api/v1/commands',{data:scalar})).status(),400);
 const viewer=await request.newContext({baseURL:host.origin});const vt=await login(viewer,'viewer');
 assert.equal((await viewer.post('/api/v1/commands',{headers:{'X-CSRF-TOKEN':vt},data:scalar})).status(),403);
 let r=await api.post('/api/v1/commands',{headers,data:scalar});assert.equal(r.status(),200,await r.text());let record=await r.json();
 assert.equal((await(await api.get('/api/v1/heating-curve/context')).json()).available,false);
 const cc=await(await api.get('/api/v1/heating-curve/context')).json();const curve={idempotencyKey:randomUUID(),expectedStateRevision:cc.expectedStateRevision,desired:{...cc.current,heatingOffTemperature:19}};
 assert.equal((await api.post('/api/v1/heating-curve/commands',{headers,data:curve})).status(),409);
 assert.equal((await api.post('/api/v1/commands/'+record.id+'/cancel',{headers,data:{}})).status(),200);
 r=await api.post('/api/v1/heating-curve/commands',{headers,data:curve});assert.equal(r.status(),200,await r.text());const cr=await r.json();
 assert.equal((await(await api.get('/api/v1/commands/context?commandType=setDhwHeatDelta')).json()).available,false);
 assert.equal((await api.post('/api/v1/heating-curve/commands/'+cr.id+'/cancel',{headers,data:{}})).status(),200);
 r=await api.post('/api/v1/commands',{headers,data:{...scalar,idempotencyKey:randomUUID()}});assert.equal(r.status(),200,await r.text());record=await r.json();
 assert.equal((await api.post('/api/v1/commands/'+record.id+'/confirm',{headers,data:{confirmed:false}})).status(),422);
 assert.equal((await api.post('/api/v1/commands/'+record.id+'/confirm',{headers,data:{confirmed:true}})).status(),202);
 for(let i=0;i<80;i++){const r=await(await api.get('/api/v1/commands/'+record.id)).json();if(r.state==='observedMatchingState')break;if(i===79)throw Error('No scalar readback');await new Promise(r=>setTimeout(r,250));}
 assert.equal((await(await api.get('/api/v1/heating-curve/context')).json()).available,true);
 browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto(host.origin);
 await page.getByRole('button',{name:'Steuerung',exact:true}).click();await page.getByRole('heading',{name:'Simulatorsteuerung',exact:true}).waitFor();
 let sortingPosts=0;
 const countSortingPosts=req=>{if(req.method()==='POST' && req.url().includes('/api/v1/'))sortingPosts++;};
 page.on('request',countSortingPosts);
 await page.getByRole('button',{name:'Kacheln anordnen',exact:true}).click();
 await page.getByRole('button',{name:'Betriebsart nach hinten',exact:true}).click();
 assert.equal(await page.locator('.control-status-grid > [data-sort-key]').nth(1).getAttribute('data-sort-key'),'mode');
 assert.equal(await page.locator('.control-page > :last-child').getByRole('heading',{name:'Simulatorsteuerung',exact:true}).count(),1);
 assert.equal(await page.locator('.control-page > :last-child .sort-controls').count(),0);
 await page.getByRole('button',{name:'Anordnung fertig',exact:true}).click();
 assert.equal(sortingPosts,0);page.off('request',countSortingPosts);
 await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByText('Angemeldet:',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Heizkurve',exact:true}).click();await page.locator('#curve-xCold').waitFor();assert.equal(await page.getByRole('button',{name:'Anmelden',exact:true}).count(),0);
 await api.dispose();await viewer.dispose();await stop(host.child);
 const steril=await start('sterilization');await page.goto(steril.origin);
 await page.getByRole('button',{name:'Steuerung',exact:true}).click();
 const status=page.getByRole('region',{name:'Sterilisation',exact:true});
 await status.getByText('Inaktiv',{exact:true}).waitFor();assert.ok((await status.innerText()).includes('65 °C'));assert.ok((await status.innerText()).includes('10 min'));
 await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByText('Angemeldet:',{exact:false}).waitFor();
 await page.getByLabel('Parameter',{exact:true}).selectOption('startSterilization');
 assert.equal(await page.getByRole('spinbutton').count(),0);
 await page.getByRole('button',{name:'Änderung prüfen',exact:true}).click();
 await page.getByRole('region',{name:'Änderung bestätigen'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Jetzt im Simulator bestätigen'}).isEnabled(),false);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Jetzt im Simulator bestätigen'}).click();
 await page.locator('.command-log').getByText('Übereinstimmender Zustand beobachtet',{exact:true}).waitFor({timeout:25000});
 await status.getByText('Aktiv',{exact:true}).waitFor();assert.ok((await page.locator('.command-log').innerText()).includes('nicht als abgeschlossen'));
 assert.equal(await page.getByRole('button',{name:'Änderung prüfen',exact:true}).isEnabled(),false);
 await page.screenshot({path:path.join(work,'sterilization-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(work,'sterilization-mobile.png'),fullPage:true});
 await stop(steril.child);
 for (const [type,value,label] of [['setSterilizationTemperature','70','Sterilisationstemperatur'],['setSterilizationMaxTime','20','Sterilisation – maximale Dauer'],['setIndoorTemperature','23','Innen-Soll (Heizen, Zone 1)'],['setQuietMode','3','Flüstermodus'],['setOperatingMode','1','Betriebsart']]) {
   const extended=await start(type); await page.setViewportSize({width:1440,height:1000}); await page.goto(extended.origin);
   await page.getByRole('button',{name:'Steuerung',exact:true}).click();
   assert.equal(await page.getByText('Heizkurvenverschiebung',{exact:true}).count(),0);
   await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByText('Angemeldet:',{exact:false}).waitFor();
   await page.getByLabel('Parameter',{exact:true}).selectOption(type);
   const input=page.getByLabel('Gewünschter Wert',{exact:false});await input.waitFor();
   for(let i=0;i<50 && !(await input.isEnabled());i++)await page.waitForTimeout(100);
   if(!['setQuietMode','setOperatingMode'].includes(type))await input.fill(value);else await input.selectOption(value);
   if(type==='setOperatingMode'){assert.equal(await input.locator('option').count(),8);assert.ok((await page.locator('main').innerText()).includes('Freischaltung am Bedienteil'));}
   await page.getByRole('button',{name:'Änderung prüfen',exact:true}).click();
   const confirmation=page.getByRole('region',{name:'Änderung bestätigen'});await confirmation.waitFor();assert.ok((await confirmation.innerText()).includes(label));
   await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Jetzt im Simulator bestätigen'}).click();
   await page.locator('.command-log').getByText('Übereinstimmender Zustand beobachtet',{exact:true}).waitFor({timeout:25000});
   await page.screenshot({path:path.join(work,type+'-desktop.png'),fullPage:true});
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.join(work,type+'-mobile.png'),fullPage:true});await stop(extended.child);
 }
 const brokerPort=await port();
 const live=await start('staging',{Source:'mqtt',LiveControl__ProfileConfirmed:'true',LiveControl__AllowSharedCredentials:'true',Mqtt__IsolatedTestBroker:'true',Mqtt__LiveReadOnly:'false',Mqtt__Host:'127.0.0.1',Mqtt__Port:String(brokerPort),Mqtt__Username:'isolated-reader',Mqtt__Password:password});
 const check=await request.newContext({baseURL:live.origin});const ls=await(await check.get('/api/v1/system')).json();assert.equal(ls.liveControlArmed,false);assert.ok(ls.capabilities.includes('liveCommands'));
 const lt=await login(check);const ctx=await(await check.get('/api/v1/commands/context?commandType=setDhwHeatDelta')).json();assert.equal(ctx.source,'mqtt');assert.equal(ctx.available,false);assert.equal(ctx.minimum,-12);assert.equal(ctx.maximum,-2);assert.equal(ctx.remainingSends,null);
 await page.goto(live.origin);await page.getByRole('button',{name:'Steuerung',exact:true}).click();await page.getByRole('heading',{name:'Anlagensteuerung',exact:true}).waitFor();assert.ok(!(await page.locator('main').innerText()).includes('SIMULATION'));await page.screenshot({path:path.join(work,'live-control.png'),fullPage:true});
 await check.dispose();await stop(live.child);
 console.log('Combined control and sterilization: auth, roles, CSRF, reservation, readback, explicit start confirmation, active status, shared login and staged live UI passed. '+work);
} finally {if(browser)await browser.close();for(const p of processes)await stop(p);}
