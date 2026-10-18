import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.js';
import { handleApi, todayIn } from '../server/api.js';

describe('Accounts, persistent progress, and authorization', () => {
  let db, directory, file, alice, bob, aliceCookie, bobCookie, today;
  const password = 'Test-only password 42!';
  async function request(path, {method='GET', body, cookie, origin, raw, ...options} = {}) {
    const headers = { ...(body || raw ? {'Content-Type':'application/json'} : {}), ...(cookie ? {cookie} : {}), ...(origin ? {origin} : {}) };
    const response = await handleApi(new Request('http://localhost:3000'+path,{method,headers,body:raw || (body ? JSON.stringify(body) : undefined)}),db,options);
    return { status:response.status, data:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0], headers:response.headers };
  }
  const post = (path,body,cookie) => request(path,{method:'POST',body,cookie});
  const checkin = (date,extras={}) => ({entry_date:date,readiness:7,fear:4,movement:'Turn left',mood:'hopeful',win:'I paused and noticed how I felt.',notes:'',...extras});
  before(() => {directory=mkdtempSync(join(tmpdir(),'small-steps-test-'));file=join(directory,'test.sqlite');db=openDatabase(file);today=todayIn('Asia/Singapore');});
  after(() => {db?.close();for(const suffix of ['', '-shm', '-wal'])rmSync(file+suffix,{force:true});rmdirSync(directory);});

  it('creates normal users, hashes passwords, and hashes session tokens',async()=>{
    const first=await post('/api/auth/signup',{name:'Alice Sample',email:'Alice@example.test',password,timezone:'Asia/Singapore',role:'admin'});
    assert.equal(first.status,200);alice=first.data.user;aliceCookie=first.cookie;
    assert.equal(alice.role,'user');assert.equal(alice.email,'alice@example.test');assert.ok(!('password_hash' in alice));
    assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/SameSite=Lax/);
    const stored=db.prepare('SELECT password_hash FROM users WHERE id=?').bind(alice.id).first();assert.match(stored.password_hash,/^scrypt-v2:32768:8:3:/);assert.ok(!stored.password_hash.includes(password));
    const session=db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').bind(alice.id).first();assert.ok(!aliceCookie.includes(session.token_hash));
    const second=await post('/api/auth/signup',{name:'Bob Sample',email:'bob@example.test',password,timezone:'Asia/Singapore'});bob=second.data.user;bobCookie=second.cookie;assert.equal(bob.role,'user');
  });
  it('rejects duplicate emails, bad credentials, anonymous access, and cross-site writes',async()=>{
    assert.equal((await post('/api/auth/signup',{name:'Duplicate',email:'ALICE@EXAMPLE.TEST',password})).status,409);
    assert.equal((await post('/api/auth/login',{email:alice.email,password:'incorrect password'})).status,401);
    assert.equal((await request('/api/dashboard')).status,401);
    assert.equal((await request('/api/checkins',{method:'POST',body:checkin(today),cookie:aliceCookie,origin:'https://untrusted.example'})).status,403);
    assert.equal((await request('/api/checkins',{method:'POST',raw:'{broken',cookie:aliceCookie})).status,400);
    assert.equal((await post('/api/auth/signup',{name:'Bad',email:'bad-email',password})).status,400);
  });
  it('stores check-ins and updates a day without multiplying records or points',async()=>{
    const saved=await post('/api/checkins',checkin(today),aliceCookie);assert.equal(saved.status,200);assert.equal(saved.data.checkins.length,1);assert.equal(saved.data.xp,75);
    const updated=await post('/api/checkins',checkin(today,{readiness:2,fear:9}),aliceCookie);assert.equal(updated.data.checkins.length,1);assert.equal(updated.data.checkins[0].readiness,2);assert.equal(updated.data.xp,75);
    assert.equal((await post('/api/checkins',checkin(today,{readiness:11}),aliceCookie)).status,400);
    assert.equal((await post('/api/checkins',checkin('2099-01-01'),aliceCookie)).status,400);
    assert.equal((await post('/api/checkins',checkin('2026-02-30'),aliceCookie)).status,400);
    assert.equal((await post('/api/checkins',checkin(today,{movement:'unsupported'}),aliceCookie)).status,400);
  });
  it('keeps accounts isolated and protects administrator endpoints',async()=>{
    const own=await request('/api/dashboard',{cookie:bobCookie});assert.equal(own.data.checkins.length,0);
    const aliceData=await request('/api/dashboard',{cookie:aliceCookie}), id=aliceData.data.checkins[0].id;
    assert.equal((await request('/api/checkins/'+id,{method:'DELETE',cookie:bobCookie})).status,404);
    assert.equal((await request('/api/admin/users',{cookie:bobCookie})).status,403);
    assert.equal((await request('/api/admin/users/'+alice.id,{cookie:bobCookie})).status,403);
  });
  it('saves gratitude and reframing, validates pairs, and updates one reflection per day',async()=>{
    assert.equal((await post('/api/reflections',{entry_date:today,gratitude:'',challenge:'A thought',reframe:''},aliceCookie)).status,400);
    const body={entry_date:today,gratitude:'A friend who listened.',challenge:'A hard day means I lost all progress.',reframe:'One difficult day does not erase the days before it.'};
    const saved=await post('/api/reflections',body,aliceCookie);assert.equal(saved.status,200);assert.equal(saved.data.reflections.length,1);assert.equal(saved.data.xp,125);
    const edited=await post('/api/reflections',{...body,gratitude:'A quiet moment.'},aliceCookie);assert.equal(edited.data.reflections.length,1);assert.equal(edited.data.reflections[0].gratitude,'A quiet moment.');
  });
  it('awards nonconsecutive milestones and keeps them after a setback or deletion',async()=>{
    const yesterday=new Date(today+'T12:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-2);
    const beforeThat=new Date(today+'T12:00:00Z');beforeThat.setUTCDate(beforeThat.getUTCDate()-5);
    await post('/api/checkins',checkin(yesterday.toISOString().slice(0,10)),aliceCookie);
    const third=await post('/api/checkins',checkin(beforeThat.toISOString().slice(0,10),{readiness:0,fear:10}),aliceCookie);
    assert.ok(third.data.milestones.find(x=>x.key==='three-days').earned_at);
    const earnedAt=third.data.milestones.find(x=>x.key==='three-days').earned_at;
    const removed=await request('/api/checkins/'+third.data.checkins[0].id,{method:'DELETE',cookie:aliceCookie});
    assert.equal(removed.data.checkins.length,2);assert.equal(removed.data.milestones.find(x=>x.key==='three-days').earned_at,earnedAt);
  });
  it('persists profile, entries, and sessions across a database restart',async()=>{
    const updated=await request('/api/profile',{method:'PATCH',cookie:aliceCookie,body:{name:'Alice Updated',goal:'Trust my own pace.',recovery_focus:'Changing direction',timezone:'Asia/Singapore'}});
    assert.equal(updated.status,200);db.close();db=openDatabase(file);
    const loaded=await request('/api/dashboard',{cookie:aliceCookie});assert.equal(loaded.data.user.name,'Alice Updated');assert.equal(loaded.data.user.goal,'Trust my own pace.');assert.equal(loaded.data.checkins.length,2);assert.equal(loaded.data.reflections.length,1);
    const exported=await request('/api/export',{cookie:aliceCookie});assert.match(exported.headers.get('content-disposition'),/attachment/);assert.ok(!JSON.stringify(exported.data).includes('password_hash'));
  });
  it('allows a database-authorized administrator to view member records',async()=>{
    db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(alice.id).run();
    const list=await request('/api/admin/users',{cookie:aliceCookie});assert.equal(list.status,200);assert.equal(list.data.users.length,2);assert.ok(!JSON.stringify(list.data).includes('password_hash'));
    const detail=await request('/api/admin/users/'+bob.id,{cookie:aliceCookie});assert.equal(detail.status,200);assert.equal(detail.data.user.id,bob.id);assert.deepEqual(detail.data.checkins,[]);
  });
  it('changes passwords, revokes old sessions, and supports logout',async()=>{
    const login=await post('/api/auth/login',{email:alice.email,password});assert.equal(login.status,200);
    const wrong=await post('/api/password',{current_password:'wrong password',new_password:'A different password 43!'},aliceCookie);assert.equal(wrong.status,400);
    const changed=await post('/api/password',{current_password:password,new_password:'A different password 43!'},aliceCookie);assert.equal(changed.status,200);
    assert.equal((await request('/api/me',{cookie:aliceCookie})).status,401);assert.equal((await request('/api/me',{cookie:login.cookie})).status,401);
    assert.equal((await post('/api/auth/login',{email:alice.email,password})).status,401);
    aliceCookie=changed.cookie;assert.equal((await request('/api/me',{cookie:aliceCookie})).status,200);
    await post('/api/auth/logout',{},aliceCookie);assert.equal((await request('/api/me',{cookie:aliceCookie})).status,401);
  });
  it('uses each account’s time zone at day boundaries',()=>{
    const instant=new Date('2026-10-18T18:00:00Z');assert.equal(todayIn('Asia/Singapore',instant),'2026-10-19');assert.equal(todayIn('America/Los_Angeles',instant),'2026-10-18');
  });
  it('limits repeated login attempts',async()=>{
    for(let i=0;i<15;i++)assert.equal((await post('/api/auth/login',{email:'missing@example.test',password})).status,401);
    assert.equal((await post('/api/auth/login',{email:'missing@example.test',password})).status,429);
  });
});
