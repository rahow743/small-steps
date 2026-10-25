import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/database.js';
import {handleApi} from '../server/api.js';
import {generateSampleHistory,importSampleHistory,SAMPLE_LABEL} from '../server/sample-history.js';
import {fiveMonthsBefore,buildFearSeries,fearProgressChart,fiveMonthWindows,fearMonthSummaries} from '../public/fear-chart.js';
import {refreshPresentationHistory,PRESENTATION_STEPS} from '../server/presentation-history.js';

describe('Five-month sample history and fear trend',()=>{
  it('spans five calendar months with improving averages, daily variation, and later setbacks',()=>{
    const rows=generateSampleHistory('2026-10-25');
    assert.equal(rows[0].entry_date,'2026-05-25');assert.equal(rows.at(-1).entry_date,'2026-10-25');assert.equal(rows.length,154);
    assert.equal(rows[0].fear,8);assert.equal(rows.at(-1).fear,2);
    const average=values=>values.reduce((sum,row)=>sum+row.fear,0)/values.length;
    assert.ok(average(rows.slice(0,30))>=7);assert.ok(average(rows.slice(-30))<3.5);
    assert.ok(rows.slice(-60).some((row,index,tail)=>index&&row.fear-tail[index-1].fear>=2));
    assert.ok(rows.every(row=>row.fear>=0&&row.fear<=10&&row.readiness>=0&&row.readiness<=10&&row.notes.startsWith(SAMPLE_LABEL)));
    assert.deepEqual(rows,generateSampleHistory('2026-10-25'));
    const months=fearMonthSummaries(rows.map(row=>({date:row.entry_date,score:row.fear})),'2026-10-25');
    assert.equal(months.length,5);assert.equal(months.reduce((sum,month)=>sum+month.days,0),154);
    assert.ok(months.every((month,index)=>!index||month.average<months[index-1].average));
    assert.equal(fiveMonthWindows('2026-10-25')[0].start,'2026-05-25');
    assert.ok(rows.every(row=>row.notes.includes('ACL recovery and fencing.')));
    assert.ok(rows.every(row=>row.context.length<=500&&row.fear_movement.length<=120&&row.win.length<=500));
    assert.ok(rows.some(row=>row.movement==='En garde'));assert.ok(rows.some(row=>row.movement==='Advance and retreat'));assert.ok(rows.some(row=>row.movement==='Lunge preparation'));
    assert.ok(rows.filter(row=>row.journal).every(row=>row.gratitude.startsWith('Sample: ')&&row.challenge&&row.reframe));
    assert.equal(fiveMonthsBefore('2026-07-31'),'2026-02-28');assert.equal(fiveMonthsBefore('2024-07-31'),'2024-02-29');
  });
  it('uses daily thermometer averages without double counting check-ins or mixing afterwards scores',()=>{
    const data={today:'2026-10-25',checkins:[{entry_date:'2026-10-01',fear:9},{entry_date:'2026-10-02',fear:5},{entry_date:'2026-10-15',fear:3}],fear_entries:[{entry_date:'2026-10-01',before_score:8,after_score:1},{entry_date:'2026-10-01',before_score:6,after_score:0},{entry_date:'2026-10-16',before_score:0,after_score:0},{entry_date:'2026-10-26',before_score:10}]};
    const rows=buildFearSeries(data,'5m');assert.equal(rows.length,4);assert.equal(rows[0].score,7);assert.equal(rows[1].score,5);assert.equal(rows.at(-1).score,0);
    assert.deepEqual(rows.filter(row=>row.marker).map(row=>row.date),['2026-10-01','2026-10-15']);
    const html=fearProgressChart(data,'5m',{escape:value=>value,icon:()=>'',empty:()=>'',button:()=>''});
    assert.equal((html.match(/<polyline /g)||[]).length,2,'Unrecorded days must break the line');
    assert.ok(html.includes('View daily fear ratings'));assert.ok(html.includes('14 days apart'));
    assert.equal(buildFearSeries(data,'7').length,0);
  });
  it('preserves existing records and imports once',async()=>{
    const db=openDatabase(':memory:');
    try{
      db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').bind('sample-user','Test','sample@example.test','unused','2026-01-01').run();
      db.prepare('INSERT INTO checkins(id,user_id,entry_date,readiness,fear,movement,mood,win,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind('original','sample-user','2026-10-25',6,7,'Turn left','steady','An existing real win','2026-10-25','2026-10-25').run();
      const result=await importSampleHistory(db,'SAMPLE@example.test','2026-10-25');assert.ok(result.inserted>300);
      assert.equal(db.prepare('SELECT win FROM checkins WHERE id=?').bind('original').first().win,'An existing real win');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fear_entries WHERE entry_date=?').bind('2026-10-25').first().n,0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins').first().n,154);
      assert.equal((await importSampleHistory(db,'sample@example.test','2026-10-25')).inserted,0);
      assert.equal(await importSampleHistory(db,'missing@example.test','2026-10-25'),null);
    }finally{db.close();}
  });
  it('requires the normal app session, confines member imports to themselves, and checks administrator roles',async()=>{
    const db=openDatabase(':memory:');
    const request=async(path,body,cookie)=>{const response=await handleApi(new Request('http://localhost'+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)}),db);return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
    try{
      const a=await request('/api/auth/signup',{name:'Sample User',email:'sample@example.test',password:'Test password 123!'});
      const b=await request('/api/auth/signup',{name:'Other User',email:'other@example.test',password:'Test password 123!'});
      assert.equal((await request('/api/sample-history',{confirm_sample:true})).status,401);
      assert.equal((await request('/api/sample-history',{},a.cookie)).status,400);
      const fencingCheckin=await request('/api/checkins',{entry_date:'2026-10-01',readiness:6,fear:4,movement:'En garde',mood:'steady',win:'A fencing reflection',notes:'An existing entry'},a.cookie);
      assert.equal(fencingCheckin.status,200);
      const saved=await request('/api/sample-history',{confirm_sample:true,email:b.data.user.email},a.cookie);
      assert.equal(saved.status,200);assert.equal(saved.data.data.user.email,a.data.user.email);
      assert.equal(saved.data.data.ladder_steps.length,6);assert.equal(saved.data.data.ladder_steps.filter(row=>row.status==='complete').length,3);
      assert.deepEqual(saved.data.data.ladder_steps.map(row=>row.expected_fear),[2,3,4,5,6,7]);
      const ids=saved.data.data.checkins.map(row=>row.id),stepIds=saved.data.data.ladder_steps.map(row=>row.id);
      const refreshed=await request('/api/sample-history',{confirm_sample:true,refresh_existing_samples:true,email:b.data.user.email},a.cookie);
      assert.equal(refreshed.status,200);assert.deepEqual(refreshed.data.data.checkins.map(row=>row.id),ids);
      assert.deepEqual(refreshed.data.data.ladder_steps.map(row=>row.id),stepIds);
      assert.equal(refreshed.data.data.checkins.find(row=>row.entry_date==='2026-10-01').win,'A fencing reflection');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE user_id=?').bind(b.data.user.id).first().n,0);
      assert.equal((await request('/api/admin/users/'+b.data.user.id+'/sample-history',{confirm_sample:true},a.cookie)).status,403);
      db.prepare("UPDATE users SET role='admin' WHERE id=?").bind(a.data.user.id).run();
      const admin=await request('/api/admin/users/'+b.data.user.id+'/sample-history',{confirm_sample:true},a.cookie);
      assert.equal(admin.status,200);assert.equal(admin.data.data.user.id,b.data.user.id);assert.ok(admin.data.data.fear_entries.length>=150);
    }finally{db.close();}
  });
  it('refreshes only labelled samples within the signed-in account and keeps their IDs and dates',async()=>{
    const db=openDatabase(':memory:');
    try{
      db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').bind('nicole','Nicole','nicole@example.test','unused','2026-01-01').run();
      db.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES(?,?,?,?,?)').bind('other','Other','other@example.test','unused','2026-01-01').run();
      await importSampleHistory(db,'nicole@example.test','2026-10-25');await importSampleHistory(db,'other@example.test','2026-10-25');
      const first=db.prepare('SELECT id FROM checkins WHERE user_id=? ORDER BY entry_date').bind('nicole').all().results[0].id;
      db.prepare('UPDATE checkins SET fear=10 WHERE id=?').bind(first).run();
      db.prepare('UPDATE checkins SET fear=9 WHERE user_id=?').bind('other').run();
      const updated=await refreshPresentationHistory(db,{id:'nicole'},'2026-10-25');
      assert.deepEqual([updated.checkins,updated.fear_entries,updated.micro_wins,updated.ladder_steps],[154,154,22,6]);
      assert.equal(db.prepare('SELECT fear FROM checkins WHERE id=?').bind(first).first().fear,8);
      assert.equal(db.prepare('SELECT MIN(fear) AS fear FROM checkins WHERE user_id=?').bind('other').first().fear,9);
      assert.equal((await refreshPresentationHistory(db,{id:'nicole'},'2026-10-25')).ladder_steps,0);
      assert.equal(PRESENTATION_STEPS.length,6);
    }finally{db.close();}
  });
});
