import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { startServer } from '../server/local.js';
import { openDatabase } from '../server/database.js';

const edge = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!existsSync(edge)) throw Error('Set BROWSER_PATH to a Chromium browser executable.');
const qaRoot = resolve('.sites-runtime/browser-qa'); mkdirSync(qaRoot,{recursive:true});
const qaRun = mkdtempSync(resolve(qaRoot,'run-'));
const database = resolve(qaRun,'test.sqlite');
const externalOrigin=process.env.QA_ORIGIN;
const server = externalOrigin ? null : startServer({port:0,host:'127.0.0.1',database});
if(server)await once(server,'listening');
const origin = externalOrigin || `http://127.0.0.1:${server.address().port}`;
const testEmail=externalOrigin ? `alex-${Date.now()}@qa.example` : 'alex@qa.example';
const browser = spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${resolve(qaRun,'profile')}`,'about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});
let client, sessionId, nextId=0;
const pending = new Map(), errors = [], results = [];
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function endpoint() {
  return await new Promise((resolve,reject)=>{
    let output=''; const timeout=setTimeout(()=>reject(Error('Browser debugging endpoint did not start.')),20000);
    browser.stderr.on('data',chunk=>{output+=chunk;const match=/DevTools listening on (ws:\/\/\S+)/.exec(output);if(match){clearTimeout(timeout);resolve(match[1]);}});
    browser.on('error',error=>{clearTimeout(timeout);reject(error);});
  });
}
function command(method,params={},session=sessionId) {
  const id=++nextId;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},15000);pending.set(id,{resolve,reject,timer});client.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));});
}
async function evaluate(expression) {
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed.');
  return result.result.value;
}
async function waitFor(expression) {
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){if(await evaluate(`Boolean(${expression})`))return;await pause(100);}
  throw Error('UI did not become ready: '+expression);
}
async function navigate(route,selector) {await evaluate(`location.hash=${JSON.stringify(route)}`);await waitFor(`document.querySelector(${JSON.stringify(selector)})`);await pause(80);}
async function screenshot(name) {const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(resolve(qaRoot,name+'.png'),Buffer.from(result.data,'base64'));}
try {
  client=new WebSocket(await endpoint());await once(client,'open');
  client.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if(message.method==='Log.entryAdded'&&message.params.entry.level==='error'){
      const entry=message.params.entry;
      const expectedAnonymousCheck=entry.url?.endsWith('/api/me') && entry.text.includes('401');
      if(!expectedAnonymousCheck)errors.push(entry.text);
    }
  });
  const target=await command('Target.createTarget',{url:'about:blank'},null);
  const attached=await command('Target.attachToTarget',{targetId:target.targetId,flatten:true},null);sessionId=attached.sessionId;
  await command('Page.enable');await command('Runtime.enable');await command('Log.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:origin});await waitFor("document.querySelector('#auth-form')");
  await screenshot('login-desktop');
  await evaluate("document.querySelector('[data-auth=signup]').click()");
  await evaluate(`document.querySelector('[name=name]').value='Alex Morgan';document.querySelector('[name=email]').value=${JSON.stringify(testEmail)};document.querySelector('[name=password]').value='QA account password 42!';document.querySelector('[name=confirm_password]').value='QA account password 42!';document.querySelector('#auth-form').requestSubmit()`);
  await waitFor("document.querySelector('.welcome-banner')");results.push('Signup and authenticated dashboard');
  await navigate('checkin','#checkin-form');
  await evaluate(`document.querySelector('[name=mood][value=hopeful]').checked=true;document.querySelector('[name=readiness]').value='7';document.querySelector('[name=fear]').value='3';document.querySelector('[name=movement]').value='Turn left';document.querySelector('[name=win]').value='I took a small turn with a little more trust in myself.';document.querySelector('#checkin-form').requestSubmit()`);
  await waitFor("document.querySelector('.welcome-banner')");
  let data=await evaluate("fetch('/api/dashboard').then(r=>r.json())");assert.equal(data.checkins.length,1);assert.equal(data.checkins[0].readiness,7);results.push('Check-in form persists movement, fear, mood, and a win');
  await navigate('journal','#journal-form');
  await evaluate(`document.querySelector('[name=gratitude]').value='An encouraging conversation and a quiet morning.';document.querySelector('[name=challenge]').value='I worried that a slower day meant falling behind.';document.querySelector('[name=reframe]').value='Listening to myself is progress too. I can take this at my own pace.';document.querySelector('#journal-form').requestSubmit()`);
  await waitFor("document.querySelector('.reflection-entry')");results.push('Gratitude and reframing saved through the UI');
  if(!externalOrigin){const db=openDatabase(database);db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(data.user.id).run();db.close();}
  const historical=await evaluate(`(async()=>{const dates=[1,3,5,8,11];for(let i=0;i<dates.length;i++){const day=new Date(${JSON.stringify(data.today)}+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-dates[i]);await fetch('/api/checkins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entry_date:day.toISOString().slice(0,10),readiness:[6,8,5,7,4][i],fear:[4,2,5,3,7][i],movement:'Side step',mood:'steady',win:['I made time to notice what felt different.','I gave myself permission to rest.','I shared a worry with someone I trust.','A little more confidence with a side step.','I showed up, even when I felt unsure.'][i],notes:''})});}return true;})()`);assert.equal(historical,true);
  await command('Page.reload');await waitFor("document.querySelector('#journal-form')");
  await navigate('profile','#profile-form');
  await evaluate(`document.querySelector('#profile-form [name=goal]').value='Feel more confident changing direction.';document.querySelector('#profile-form').requestSubmit()`);
  await waitFor("document.querySelector('#toast.visible')?.innerText.includes('Changes saved')");results.push('Profile editing and account refresh');
  const routes=[['overview','.welcome-banner'],['checkin','#checkin-form'],['journey','.journey-chart'],['journal','#journal-form'],['milestones','.milestones-grid'],['profile','#profile-form'],...(!externalOrigin ? [['admin','.admin-table-card']] : [])];
  for(const width of [1440,390,320]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1100:844,deviceScaleFactor:1,mobile:width<760});
    for(const [route,selector]of routes){await navigate(route,selector);const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,content:document.querySelector(".content").getBoundingClientRect().width})');assert.ok(layout.scroll<=layout.width+1,`${route} overflows at ${width}px: ${JSON.stringify(layout)}`);}
    await navigate('overview','.welcome-banner');if(width!==320)await screenshot(width===1440?'dashboard-desktop':'dashboard-mobile');results.push(`All ${routes.length} pages fit ${width}px viewport`);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  if(!externalOrigin){await navigate('admin','.admin-table-card');await evaluate("document.querySelector('.member-button').click()");await waitFor("document.querySelector('.admin-history')");assert.ok((await evaluate("document.querySelector('.admin-history').innerText")).includes('I took a small turn'));results.push('Admin can inspect real check-ins and reflections');}
  await navigate('overview','.welcome-banner');await evaluate("document.querySelector('.preview-toggle').click()");await waitFor("document.querySelector('.mobile-preview')");const preview=await evaluate('document.querySelector(".app-frame").getBoundingClientRect().width');assert.ok(preview<=410);await evaluate("document.querySelector('.preview-exit').click()");results.push('Interactive mobile preview toggle');
  await navigate('profile','#profile-form');await evaluate("document.querySelector('#logout').click()");await waitFor("document.querySelector('#auth-form')");
  // Wrangler's development proxy reloads after watched QA artifacts change.
  // Let that local reload finish before sending the next non-idempotent request.
  if(externalOrigin)await pause(2500);
  await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(testEmail)};document.querySelector('[name=password]').value='QA account password 42!';document.querySelector('#auth-form').requestSubmit()`);
  await waitFor("document.querySelector('.welcome-banner')");results.push('Sign out and sign back in through the browser');
  assert.deepEqual(errors,[],'Browser must not report JavaScript or CSP errors');
  writeFileSync(resolve(qaRoot,'results.json'),JSON.stringify({passed:results,errors},null,2));
  console.log(JSON.stringify({passed:results,screenshots:qaRoot,errors},null,2));
} finally {
  if(client?.readyState===WebSocket.OPEN){try{await command('Browser.close',{},null);}catch{}client.close();}
  if(browser.exitCode===null)browser.kill();
  if(server)await new Promise(resolve=>server.close(resolve));
}
