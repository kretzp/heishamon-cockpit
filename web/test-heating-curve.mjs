import { createTestUsers } from './test-user-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { chromium, request } from '@playwright/test';
const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(root, '.cache/m3c-test-'));
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16);
const hash = ['pbkdf2-sha256','600000',salt.toString('base64'),pbkdf2Sync(password,salt,600000,32,'sha256').toString('base64')].join('$');
const dll = path.join(root,'src/Cockpit.Web/bin/'+(process.env.COCKPIT_TEST_CONFIGURATION || 'M3cCheck')+'/net10.0/Cockpit.Web.dll');
let browser;
const processes = [];
async function port() { const server = net.createServer(); await new Promise(r => server.listen(0,'127.0.0.1',r)); const p=server.address().port; await new Promise(r=>server.close(r)); return p; }
async function start(name, extra={}) {
  const p=await port(); const fd=fs.openSync(path.join(work,name+'.log'),'w');
  const usersPath = path.join(work, name + '-users.db'); createTestUsers(usersPath, password);
  const env={...process.env, Source:'simulator', Simulator__Scenario:'normal', LocalPort:String(p), History__Path:path.join(work,name+'.db'), History__SampleSeconds:'5', Access__DatabasePath:usersPath, Access__RequireLogin:'false',
    LiveTest__Enabled:'false', HeatingCurve__Enabled:'true', Control__Enabled:'false', Control__Outcome:'match', ...extra };
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
 const host=await start('api');const api=await request.newContext({baseURL:host.origin});
 assert.equal((await api.get('/api/v1/heating-curve/commands')).status(),401);
 const token=await login(api);const headers={'X-CSRF-TOKEN':token};
 const c=await(await api.get('/api/v1/heating-curve/context')).json();assert.equal(c.available,true);
 const data={idempotencyKey:randomUUID(),expectedStateRevision:c.expectedStateRevision,desired:{...c.current,heatingOffTemperature:19}};
 assert.equal((await api.post('/api/v1/heating-curve/commands',{data})).status(),400);
 const viewer=await request.newContext({baseURL:host.origin});const vt=await login(viewer,'viewer');
 assert.equal((await viewer.post('/api/v1/heating-curve/commands',{headers:{'X-CSRF-TOKEN':vt},data})).status(),403);
 assert.equal((await api.post('/api/v1/heating-curve/commands',{headers,data:{...data,desired:{...data.desired,xWarm:-10}}})).status(),422);
 const prepared=await api.post('/api/v1/heating-curve/commands',{headers,data});assert.equal(prepared.status(),200,await prepared.text());const record=await prepared.json();
 assert.equal((await(await api.post('/api/v1/heating-curve/commands',{headers,data})).json()).id,record.id);
 assert.equal((await api.post('/api/v1/heating-curve/commands/'+record.id+'/confirm',{headers,data:{confirmed:false}})).status(),422);
 assert.equal((await api.post('/api/v1/heating-curve/commands/'+record.id+'/confirm',{headers,data:{confirmed:true}})).status(),202);
 assert.equal((await api.post('/api/v1/heating-curve/commands/'+record.id+'/confirm',{headers,data:{confirmed:true}})).status(),202);
 await waitState(api,record.id,'observedMatchingState');
 assert.equal((await api.get('/api/v1/commands')).status(),404);
 await api.dispose();await viewer.dispose();await stop(host.child);
 browser=await chromium.launch({headless:true});
 for(const mobile of [false,true]) {
  const host=await start(mobile?'mobile':'desktop');const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1050},isMobile:mobile,hasTouch:mobile});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(host.origin);await page.getByRole('button',{name:'Heizkurve',exact:true}).click();
  await page.locator('#curve-xCold').waitFor();await page.waitForFunction(()=>document.querySelector('#curve-xCold')?.value==='-10');
  let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/heating-curve/commands'))posts++;});
  await page.locator('#curve-yCold').fill('36');await page.locator('#curve-yCold').press('Enter');await page.getByRole('button',{name:'Vorschau',exact:true}).click();await page.getByText('Vorschau aktualisiert. Keine Änderung gesendet.').waitFor();assert.equal(posts,0);
  await page.getByRole('button',{name:'Zurücksetzen',exact:true}).click();assert.equal(await page.locator('#curve-yCold').inputValue(),'35');assert.equal(posts,0);
  const graph=page.locator('.curve-chart');const originalCurve=await graph.getAttribute('aria-label');
  await page.locator('#curve-xWarm').fill('-10');await page.locator('#curve-xWarm').press('Enter');
  await page.getByRole('alert').filter({hasText:'Außen niedrig muss kleiner als Außen hoch sein.'}).waitFor();
  assert.equal(await page.locator('#curve-xWarm').inputValue(),'15');assert.equal(await graph.getAttribute('aria-label'),originalCurve);
  // Both physical and relational boundaries, mouse buttons and keyboard steps.
  for(const [key,label,low,high] of [['xCold','Außen niedrig',-20,14],['xWarm','Außen hoch',-9,15],['yCold','Vorlauf hoch',25,75],['yWarm','Vorlauf niedrig',20,35],['heatDelta','Heiz-ΔT',1,15],['heatingOffTemperature','Heizung aus ab',5,35]]) {
    for(const [limit,direction] of [[low,'verringern'],[high,'erhöhen']]) {
      await page.getByRole('button',{name:'Zurücksetzen',exact:true}).click();const input=page.locator('#curve-'+key);
      await input.fill(String(limit));await input.press('Enter');assert.equal(await input.inputValue(),String(limit));
      const before=await graph.getAttribute('aria-label');
      await page.getByRole('button',{name:label+' '+direction,exact:true}).click();
      assert.equal(await input.inputValue(),String(limit));assert.equal(await graph.getAttribute('aria-label'),before);
      await page.locator('#curve-'+key+'-help').filter({hasText:'Nicht übernommen.'}).waitFor();
      await input.press(direction==='erhöhen'?'ArrowUp':'ArrowDown');await input.press('Tab');
      assert.equal(await input.inputValue(),String(limit));await page.locator('#curve-'+key+'-help').filter({hasText:'Nicht übernommen.'}).waitFor();
    }
  }
  await page.getByRole('button',{name:'Zurücksetzen',exact:true}).click();
  for(const invalid of ['76','19','35.5','']) {
    await page.locator('#curve-yCold').fill(invalid);await page.locator('#curve-yCold').press('Tab');
    assert.equal(await page.locator('#curve-yCold').inputValue(),'35');assert.equal(await graph.getAttribute('aria-label'),originalCurve);
    await page.locator('#curve-yCold-help').filter({hasText:'Nicht übernommen.'}).waitFor();
  }
  await page.locator('#curve-yCold').focus();await page.locator('#curve-yCold').press('ControlOrMeta+A');await page.locator('#curve-yCold').pressSequentially('42');
  assert.equal(await graph.getAttribute('aria-label'),originalCurve);await page.locator('#curve-yCold').press('Enter');
  assert.equal(await page.locator('#curve-yCold').inputValue(),'42');assert.equal(await page.locator('#curve-yCold').getAttribute('aria-invalid'),'false');assert.equal(posts,0);
  await page.getByRole('button',{name:'Zurücksetzen',exact:true}).click();
  await page.locator('#curve-yCold').fill('36');await page.locator('#curve-yCold').press('Enter');
  // Simulate a competing controller in the context response only; local draft must survive.
  await page.route('**/api/v1/heating-curve/context',async route=>{const response=await route.fetch();const c=await response.json();c.current.yCold=34;await route.fulfill({response,json:c});});
  await page.getByText('Anlagenwerte wurden extern geändert. Deine Eingaben bleiben erhalten.').waitFor();assert.equal(await page.locator('#curve-yCold').inputValue(),'36');
  await page.getByRole('button',{name:'Eigene Eingaben beibehalten',exact:true}).click();assert.equal(await page.locator('#curve-yCold').inputValue(),'36');
  await page.unroute('**/api/v1/heating-curve/context');await page.getByRole('button',{name:'Neue Anlagenwerte laden',exact:true}).waitFor();await page.getByRole('button',{name:'Neue Anlagenwerte laden',exact:true}).click();
  await page.getByLabel('Benutzername',{exact:true}).fill('operator');await page.getByLabel('Passwort',{exact:true}).fill(password);await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByRole('button',{name:'Abmelden',exact:true}).waitFor();
  await page.locator('#curve-heatingOffTemperature').fill('19');await page.locator('#curve-heatingOffTemperature').press('Enter');await page.getByRole('button',{name:'Heizkurve übernehmen',exact:true}).click();await page.getByRole('button',{name:'Jetzt bestätigt senden',exact:true}).waitFor();
  assert.equal(posts,1);await page.getByRole('button',{name:'Jetzt bestätigt senden',exact:true}).click();await page.getByRole('heading',{name:'Übereinstimmende Anlagenwerte beobachtet',exact:true}).waitFor({timeout:20000});assert.equal(posts,2);await page.getByText('Keine lokalen Änderungen',{exact:true}).waitFor();assert.equal(await page.getByText('Anlagenwerte wurden extern geändert. Deine Eingaben bleiben erhalten.').count(),0);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(work,mobile?'mobile.png':'desktop.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
  await context.close();await stop(host.child);
 }
 const readOnly=await start('readonly',{HeatingCurve__Enabled:'false'});assert.equal((await fetch(readOnly.origin+'/api/v1/system').then(r=>r.json())).readOnly,true);assert.equal((await fetch(readOnly.origin+'/api/v1/heating-curve/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);await stop(readOnly.child);
 const secure=await start('https-guard',{Source:'mqtt',Mqtt__Host:'127.0.0.1',Mqtt__Port:String(await port()),Mqtt__LiveReadOnly:'true',Mqtt__IsolatedTestBroker:'false',Mqtt__UseTls:'false',Mqtt__Username:'reader-fixture',HeatingCurve__Username:'writer-fixture',HeatingCurve__Password:password,HeatingCurve__ProfileConfirmed:'true',HeatingCurve__ExpiresUtc:new Date(Date.now()+1800000).toISOString()});
 assert.equal((await fetch(secure.origin+'/api/v1/heating-curve/context')).status,403);
 assert.equal((await fetch(secure.origin+'/api/v1/auth/session')).status,403);
 assert.equal((await fetch(secure.origin+'/api/v1/auth/session',{headers:{'X-Forwarded-Proto':'https'}})).status,200);
 await stop(secure.child);
 for(const name of fs.readdirSync(work).filter(n=>n.endsWith('.log')))assert.equal(fs.readFileSync(path.join(work,name),'utf8').includes(password),false);
 console.log('M3c API and browser tests passed; screenshots: '+work);
} finally {if(browser)await browser.close();for(const child of processes)await stop(child);}
