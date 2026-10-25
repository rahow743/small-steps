import {createHash} from 'node:crypto';
import {generateSampleHistory,SAMPLE_LABEL} from './sample-history.js';

export const PRESENTATION_NAME='Nicole';
const idFor=(userId,index)=>{
  const value=createHash('sha256').update(`fencing-presentation-step-v1:${userId}:${index}`).digest('hex');
  return `${value.slice(0,8)}-${value.slice(8,12)}-5${value.slice(13,16)}-a${value.slice(17,20)}-${value.slice(20,32)}`;
};
export const PRESENTATION_STEPS=[
  {title:'Visit the fencing hall and watch a session',expected_fear:2,status:'complete',description:'Sample: Stay connected to my fencing club after my ACL injury. Watch from a place where I feel comfortable and leave when I want to.'},
  {title:'Settle into en garde with my physiotherapist',expected_fear:3,status:'complete',description:'Sample: In the session already agreed with my physiotherapist, notice how the familiar stance feels in my recovering knee. I can pause and talk about any worry.'},
  {title:'Try a short advance-and-retreat sequence',expected_fear:4,status:'complete',description:'Sample: Explore the footwork already included in my individual rehab plan, with support nearby. Notice one thing that felt reassuring.'},
  {title:'Practise a controlled change of direction',expected_fear:5,status:'planned',description:'Sample: When my physiotherapist agrees, explore changing between advancing and retreating. Keep the setting predictable and ask my coach for space.'},
  {title:'Try a small lunge and return to en garde',expected_fear:6,status:'planned',description:'Sample: Discuss this step with my physiotherapist first. When it belongs in my plan, try it with support and notice how I feel about trusting my knee.'},
  {title:'Join a short, supported fencing drill',expected_fear:7,status:'planned',description:'Sample: When agreed with my care team, choose a predictable drill with my coach and a trusted partner. I decide when to pause; there is no competition deadline.'},
];

export async function seedPresentationLadder(db,userId,through) {
  const existing=(await db.prepare('SELECT id FROM ladder_steps WHERE user_id=?').bind(userId).all()).results;
  // Keep a member's own steps and chosen ordering. Seed only an empty ladder.
  if(existing.length)return 0;
  const now=new Date().toISOString(),rows=generateSampleHistory(through);
  await db.batch(PRESENTATION_STEPS.map((step,index)=>{
    const completed=step.status==='complete'?rows[Math.min(rows.length-1,35+index*32)].entry_date:null;
    return db.prepare('INSERT OR IGNORE INTO ladder_steps (id,user_id,title,description,expected_fear,status,position,completed_at,completed_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(idFor(userId,index),userId,step.title,step.description,step.expected_fear,step.status,index,completed?completed+'T12:00:00.000Z':null,completed,now,now);
  }));
  return 6;
}

export async function refreshPresentationHistory(db,user,through) {
  const generated=new Map(generateSampleHistory(through).map(row=>[row.entry_date,row]));
  const checkins=(await db.prepare('SELECT id,entry_date,notes FROM checkins WHERE user_id=?').bind(user.id).all()).results;
  const fear=(await db.prepare('SELECT id,entry_date,context FROM fear_entries WHERE user_id=?').bind(user.id).all()).results;
  const wins=(await db.prepare('SELECT id,entry_date,notes FROM micro_wins WHERE user_id=?').bind(user.id).all()).results;
  const statements=[],now=new Date().toISOString(),counts={checkins:0,fear_entries:0,micro_wins:0};
  for(const entry of checkins){
    const row=generated.get(entry.entry_date);if(!row||!entry.notes.startsWith(SAMPLE_LABEL))continue;
    statements.push(db.prepare('UPDATE checkins SET readiness=?,fear=?,mood=?,movement=?,win=?,notes=?,updated_at=? WHERE id=? AND user_id=?').bind(row.readiness,row.fear,row.mood,row.movement,row.win,row.notes,now,entry.id,user.id));counts.checkins++;
  }
  for(const entry of fear){
    const row=generated.get(entry.entry_date);if(!row||!entry.context.startsWith(SAMPLE_LABEL))continue;
    statements.push(db.prepare('UPDATE fear_entries SET movement=?,before_score=?,after_score=?,context=?,support=?,updated_at=? WHERE id=? AND user_id=?').bind(row.fear_movement,row.before_score,row.after_score,row.context,row.support,now,entry.id,user.id));counts.fear_entries++;
  }
  for(const entry of wins){
    const row=generated.get(entry.entry_date);if(!row||!entry.notes.startsWith(SAMPLE_LABEL))continue;
    statements.push(db.prepare('UPDATE micro_wins SET win=?,notes=?,gratitude=?,challenge=?,reframe=?,updated_at=? WHERE id=? AND user_id=?').bind(row.win,row.notes,row.gratitude,row.challenge,row.reframe,now,entry.id,user.id));counts.micro_wins++;
  }
  if(statements.length)await db.batch(statements);
  counts.ladder_steps=await seedPresentationLadder(db,user.id,through);
  return {...counts,sample_data:true};
}
