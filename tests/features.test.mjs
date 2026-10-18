import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../server/database.js';
import { handleApi, todayIn } from '../server/api.js';
import { monthWindows, buildComparison } from '../server/features.js';

describe('Fear thermometer, ladder map, and micro-win journal',()=>{
  let directory,file,db,cookie,otherCookie,userId,today,fearId,stepIds,winId;
  async function request(path,method='GET',body,session=cookie){
    const response=await handleApi(new Request('http://localhost:3000'+path,{method,headers:{...(session?{cookie:session}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),db);
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  before(async()=>{
    directory=mkdtempSync(join(tmpdir(),'small-steps-features-'));file=join(directory,'features.sqlite');db=openDatabase(file);today=todayIn('Asia/Singapore');
    const a=await request('/api/auth/signup','POST',{name:'Feature Test',email:'feature@qa.example',password:'Feature test password 42!',timezone:'Asia/Singapore'},null);cookie=a.cookie;userId=a.data.user.id;
    const b=await request('/api/auth/signup','POST',{name:'Other Test',email:'other@qa.example',password:'Feature test password 42!',timezone:'Asia/Singapore'},null);otherCookie=b.cookie;
  });
  after(()=>{db.close();for(const suffix of ['','-shm','-wal'])rmSync(file+suffix,{force:true});rmdirSync(directory);});
  it('persists multiple fear ratings in a day, preserves a zero after-score, and rejects invalid values',async()=>{
    const body={entry_date:today,movement:'Thinking about a turn',before_score:7,after_score:3,context:'A new setting',support:'I made room for a pause.'};
    const first=await request('/api/fear-entries','POST',body);assert.equal(first.status,200);fearId=first.data.fear_entries[0].id;assert.equal(first.data.fear_entries[0].before_score,7);
    const second=await request('/api/fear-entries','POST',{...body,before_score:5,after_score:null});assert.equal(second.data.fear_entries.length,2);
    const edited=await request('/api/fear-entries/'+fearId,'PATCH',{after_score:0});assert.equal(edited.data.fear_entries.find(x=>x.id===fearId).after_score,0);
    assert.equal((await request('/api/fear-entries','POST',{...body,before_score:11})).status,400);
    assert.equal((await request('/api/fear-entries','POST',{...body,after_score:-1})).status,400);
    assert.equal((await request('/api/fear-entries','POST',{...body,entry_date:'2099-01-01'})).status,400);
    assert.equal((await request('/api/fear-entries','POST',{...body,movement:''})).status,400);
  });
  it('saves, reorders, and completes ladder steps without losing earned milestones',async()=>{
    await request('/api/ladder-steps','POST',{title:'A small beginning',description:'With support that feels right.',expected_fear:2});
    const second=await request('/api/ladder-steps','POST',{title:'Another small step',expected_fear:5});stepIds=second.data.ladder_steps.map(x=>x.id);
    const reordered=await request('/api/ladder-steps/reorder','POST',{ordered_ids:[...stepIds].reverse()});assert.deepEqual(reordered.data.ladder_steps.map(x=>x.id),[...stepIds].reverse());
    const completed=await request('/api/ladder-steps/'+stepIds[0],'PATCH',{status:'complete'});assert.equal(completed.status,200);
    const entry=completed.data.ladder_steps.find(x=>x.id===stepIds[0]);assert.equal(entry.completed_date,today);assert.ok(entry.completed_at);assert.ok(completed.data.milestones.find(x=>x.key==='first-ladder-step').earned_at);
    const repeated=await request('/api/ladder-steps/'+stepIds[0],'PATCH',{status:'complete'});assert.equal(repeated.data.ladder_steps.find(x=>x.id===stepIds[0]).completed_at,entry.completed_at);
    const reset=await request('/api/ladder-steps/'+stepIds[0],'PATCH',{status:'working'});assert.equal(reset.data.ladder_steps.find(x=>x.id===stepIds[0]).completed_date,null);assert.ok(reset.data.milestones.find(x=>x.key==='first-ladder-step').earned_at);
    assert.equal((await request('/api/ladder-steps/reorder','POST',{ordered_ids:[stepIds[0],stepIds[0]]})).status,400);
    assert.equal((await request('/api/ladder-steps/'+stepIds[0],'PATCH',{status:'made-up'})).status,400);
    assert.equal((await request('/api/ladder-steps/'+stepIds[0],'PATCH',{expected_fear:12})).status,400);
  });
  it('keeps several journal wins per day and validates paired reframing fields before saving',async()=>{
    const body={entry_date:today,win:'I listened to myself.',category:'self_kindness',notes:'Small but meaningful.',gratitude:'A kind conversation.',challenge:'I felt behind.',reframe:'I can take my own pace.'};
    const saved=await request('/api/micro-wins','POST',body);assert.equal(saved.status,200);winId=saved.data.micro_wins[0].id;
    const twice=await request('/api/micro-wins','POST',{...body,win:'I noticed a reason to be grateful.'});assert.equal(twice.data.micro_wins.length,2);
    const edited=await request('/api/micro-wins/'+winId,'PATCH',{notes:'An updated note.'});assert.equal(edited.data.micro_wins.find(x=>x.id===winId).notes,'An updated note.');
    assert.equal((await request('/api/micro-wins','POST',{...body,reframe:''})).status,400);
    assert.equal((await request('/api/micro-wins','POST',{...body,win:'  '})).status,400);
    assert.equal((await request('/api/micro-wins','POST',{...body,category:'unsupported'})).status,400);
    assert.equal((await request('/api/dashboard')).data.micro_wins.length,2);
  });
  it('enforces account ownership for every new entity and for ladder reordering',async()=>{
    for(const [path,id]of [['fear-entries',fearId],['ladder-steps',stepIds[0]],['micro-wins',winId]]){
      assert.equal((await request('/api/'+path+'/'+id,'PATCH',{},otherCookie)).status,404);
      assert.equal((await request('/api/'+path+'/'+id,'DELETE',undefined,otherCookie)).status,404);
    }
    assert.equal((await request('/api/ladder-steps/reorder','POST',{ordered_ids:stepIds},otherCookie)).status,400);
    const other=await request('/api/dashboard','GET',undefined,otherCookie);assert.deepEqual(other.data.fear_entries,[]);assert.deepEqual(other.data.ladder_steps,[]);assert.deepEqual(other.data.micro_wins,[]);
    assert.equal((await request('/api/fear-entries','POST',{entry_date:today},null)).status,401);
  });
  it('survives a database restart and includes new records in exports and authorized admin views',async()=>{
    db.close();db=openDatabase(file);
    const saved=await request('/api/dashboard');assert.equal(saved.data.fear_entries.length,2);assert.equal(saved.data.ladder_steps.length,2);assert.equal(saved.data.micro_wins.length,2);
    assert.equal(saved.data.micro_wins.find(x=>x.id===winId).notes,'An updated note.');
    const exported=await request('/api/export');assert.equal(exported.data.fear_entries.length,2);assert.equal(exported.data.ladder_steps.length,2);assert.equal(exported.data.micro_wins.length,2);
    db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(userId).run();
    const admin=await request('/api/admin/users/'+userId);assert.equal(admin.status,200);assert.equal(admin.data.micro_wins.length,2);assert.ok(!JSON.stringify(admin.data).includes('password_hash'));
    const removed=await request('/api/fear-entries/'+fearId,'DELETE');assert.equal(removed.data.fear_entries.length,1);assert.ok(removed.data.milestones.find(x=>x.key==='fear-awareness').earned_at);
  });
});

describe('Calendar comparison and existing-data preservation',()=>{
  it('matches dates across year boundaries and caps shorter previous months',()=>{
    assert.deepEqual(monthWindows('2026-01-18'),{current:{start:'2026-01-01',end:'2026-01-18'},previous:{start:'2025-12-01',end:'2025-12-18'}});
    assert.equal(monthWindows('2024-03-31').previous.end,'2024-02-29');assert.equal(monthWindows('2026-03-31').previous.end,'2026-02-28');
  });
  it('uses recorded daily scores, keeps missing averages null, and separates thermometer samples',()=>{
    const comparison=buildComparison('2026-01-18',{
      checkins:[{entry_date:'2026-01-01',readiness:4,fear:8,win:'A win'},{entry_date:'2026-01-18',readiness:8,fear:2,win:''},{entry_date:'2025-12-01',readiness:2,fear:9,win:'An earlier win'},{entry_date:'2025-12-19',readiness:10,fear:0,win:'Outside the matched period'}],
      reflections:[{entry_date:'2026-01-03',gratitude:'A little kindness',challenge:'A thought',reframe:'A kinder view'}],
      micro_wins:[{entry_date:'2026-01-02',gratitude:'A friend',challenge:'',reframe:''}],
      fear_entries:[{entry_date:'2026-01-01',before_score:10,after_score:0}],
      ladder_steps:[{completed_date:'2026-01-05'},{completed_date:'2025-12-05'}],
    });
    assert.equal(comparison.current.readiness,6);assert.equal(comparison.current.fear,5);assert.equal(comparison.previous.readiness,2);assert.equal(comparison.previous.checkin_days,1);assert.equal(comparison.current.win_entries,2);assert.equal(comparison.current.gratitude_entries,2);assert.equal(comparison.current.completed_steps,1);assert.equal(comparison.current.thermometer_after,0);assert.equal(comparison.previous.thermometer_before,null);
    const empty=buildComparison('2026-01-18',{checkins:[],reflections:[],micro_wins:[],fear_entries:[],ladder_steps:[]});assert.equal(empty.current.readiness,null);assert.equal(empty.previous.fear,null);assert.equal(empty.current.win_entries,0);
  });
  it('adds feature tables to an older database without changing saved accounts or check-ins',()=>{
    const directory=mkdtempSync(join(tmpdir(),'small-steps-upgrade-')),file=join(directory,'legacy.sqlite');
    const legacy=new DatabaseSync(file);legacy.exec(readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8').split('CREATE TABLE IF NOT EXISTS fear_entries')[0]);
    legacy.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run('legacy-user','Existing Member','legacy@qa.example','existing-hash','2026-01-01T00:00:00Z');
    legacy.prepare('INSERT INTO checkins (id,user_id,entry_date,readiness,fear,movement,mood,win,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('legacy-entry','legacy-user','2026-01-01',7,4,'Turn left','steady','A saved win','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');legacy.close();
    const upgraded=openDatabase(file);
    try{assert.equal(upgraded.prepare('SELECT win FROM checkins WHERE id=?').bind('legacy-entry').first().win,'A saved win');assert.equal(upgraded.prepare('SELECT password_hash FROM users WHERE id=?').bind('legacy-user').first().password_hash,'existing-hash');for(const table of ['fear_entries','ladder_steps','micro_wins'])assert.equal(upgraded.prepare('SELECT COUNT(*) AS count FROM '+table).first().count,0);}
    finally{upgraded.close();for(const suffix of ['','-shm','-wal'])rmSync(file+suffix,{force:true});rmdirSync(directory);}
  });
});
