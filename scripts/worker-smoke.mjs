import assert from 'node:assert/strict';
const origin=process.env.WORKER_ORIGIN || 'http://127.0.0.1:4182';
if(process.argv.includes('--diagnose')){
  for(let i=0;i<2;i++){
    const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',...(i ? {origin,referer:origin+'/#profile','Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'cors'} : {})},body:JSON.stringify({email:'missing-probe@qa.example',password:'Probe-only password 42!'})});
    console.log('Missing account probe',i+1,response.status,await response.text());
  }
  process.exit(0);
}
let cookie;
async function request(path,method='GET',body,extra={}) {
  const response=await fetch(origin+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...extra},body:body?JSON.stringify(body):undefined});
  const raw=await response.text();
  let data;try{data=JSON.parse(raw);}catch{throw Error(`${method} ${path}: ${response.status} ${raw.slice(0,200)}`);}
  if(!response.ok)throw Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').includes('Max-Age=0') ? undefined : response.headers.get('set-cookie').split(';')[0];
  return data;
}
const health=await request('/api/health');assert.equal(health.database,'connected');
const setup=await request('/api/setup');assert.equal(setup.setupRequired,true);
const name='Worker QA',email=`worker-${Date.now()}@qa.example`,password='Worker smoke password 42!';
const signup=await request('/api/auth/signup','POST',{name,email,password,timezone:'Asia/Singapore'},{'oai-authenticated-user-id':'local-worker-qa'});
assert.equal(signup.user.role,'admin');
const initial=await request('/api/dashboard');assert.equal(initial.checkins.length,0);
const saved=await request('/api/checkins','POST',{entry_date:initial.today,readiness:6,fear:4,movement:'Turn left',mood:'steady',win:'I noticed a small win.',notes:'QA data in an isolated local Worker database.'});
assert.equal(saved.checkins.length,1);assert.equal(saved.xp,75);
const reflected=await request('/api/reflections','POST',{entry_date:initial.today,gratitude:'A little space to reflect.',challenge:'A slower day felt frustrating.',reframe:'A slower day belongs in the journey too.'});assert.equal(reflected.reflections.length,1);assert.equal(reflected.xp,125);
const members=await request('/api/admin/users');assert.equal(members.users.length,1);
const member=await request('/api/admin/users/'+signup.user.id);assert.equal(member.checkins.length,1);assert.equal(member.reflections.length,1);
await request('/api/auth/logout','POST',{});
const login=await request('/api/auth/login','POST',{email,password});assert.equal(login.user.id,signup.user.id);
const html=await (await fetch(origin)).text();assert.ok(html.includes('Small Steps'));assert.ok(html.includes('/app.js'));
for(let i=0;i<3;i++){await request('/api/auth/logout','POST',{});await request('/api/auth/login','POST',{email,password});}
console.log('Worker smoke passed: D1 migrations, repeated password login, cookies, check-ins, reflections, milestone awards, admin access, and hosted HTML.');
