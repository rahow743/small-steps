import { createHash } from 'node:crypto';
import { fiveMonthsBefore, fiveMonthWindows } from '../public/fear-chart.js';
import { fencingStory } from './fencing-story.js';

export const SAMPLE_LABEL = 'Sample data: generated five-month history.';
const DAY = 86400000;
const clamp = value => Math.max(0, Math.min(10, Math.round(value)));
const stableId = (userId, kind, date) => {
  const hex = createHash('sha256').update(`small-steps-sample-v1:${userId}:${kind}:${date}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};

export function generateSampleHistory(through) {
  const start = fiveMonthsBefore(through), first = Date.parse(start), last = Date.parse(through);
  const length = Math.round((last - first) / DAY);
  const windows=fiveMonthWindows(through);
  const anchors=[8,7,5.5,4,2.8,2];
  return Array.from({ length: length + 1 }, (_, index) => {
    const date = new Date(first + index * DAY).toISOString().slice(0,10);
    const t = index / length;
    const noise = (Number.parseInt(createHash('sha256').update(date).digest('hex').slice(0,4),16) / 65535 - 0.5) * 1.2;
    const harderDay = index % 19 === 11 || index % 31 === 21;
    const harderPatch = index % 37 === 16 || index % 37 === 17;
    const month=Math.max(0,windows.findIndex(period=>date>=period.start&&date<=period.end));
    const monthStart=Date.parse(windows[month].start),monthEnd=month===4?last:Date.parse(windows[month+1].start);
    const fraction=(first+index*DAY-monthStart)/(monthEnd-monthStart);
    const baseline=anchors[month]+(anchors[month+1]-anchors[month])*fraction;
    const fear=index===0?8:index===length?2:clamp(baseline+Math.sin(index*0.48)*0.3+noise*0.6+(harderDay?2.5:harderPatch?1.5:0));
    const readiness = Math.max(1, Math.min(9, clamp(10 - fear + t * 1.2 + noise)));
    const rest = index % 9 === 5;
    const story = fencingStory(index, length, { rest, harder: harderDay || harderPatch });
    return { entry_date: date, fear, readiness, movement: story.movement, fear_movement: story.fear_movement, mood: fear >= 9 ? 'low' : fear >= 7 || harderDay ? 'unsure' : fear <= 4 ? 'hopeful' : 'steady', win: story.win, notes: `${SAMPLE_LABEL} ACL recovery and fencing. ${story.story}`, before_score: fear, after_score: index % 23 === 13 ? clamp(fear + 1) : clamp(fear - (index % 9 === 0 ? 0 : index % 3 === 0 ? 2 : 1)), context: `${SAMPLE_LABEL} ${story.story}`, support: story.support, gratitude: story.gratitude, challenge: story.challenge, reframe: story.reframe, journal: index % 7 === 3 };
  });
}

export async function importSampleHistory(db, email, through) {
  const user = await db.prepare('SELECT id, email FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
  if (!user) return null;
  const rows = generateSampleHistory(through);
  const existingCheckins = new Set((await db.prepare('SELECT entry_date FROM checkins WHERE user_id=?').bind(user.id).all()).results.map(row => row.entry_date));
  const existingFear = new Set((await db.prepare('SELECT entry_date FROM fear_entries WHERE user_id=?').bind(user.id).all()).results.map(row => row.entry_date));
  const now = new Date().toISOString(), statements = [];
  for (const row of rows) {
    if (!existingCheckins.has(row.entry_date) && !existingFear.has(row.entry_date)) statements.push(db.prepare('INSERT OR IGNORE INTO checkins (id,user_id,entry_date,readiness,fear,movement,mood,win,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(stableId(user.id,'checkin',row.entry_date),user.id,row.entry_date,row.readiness,row.fear,row.movement,row.mood,row.win,row.notes,now,now));
    if (!existingFear.has(row.entry_date) && !existingCheckins.has(row.entry_date)) statements.push(db.prepare('INSERT OR IGNORE INTO fear_entries (id,user_id,entry_date,movement,before_score,after_score,context,support,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(stableId(user.id,'fear',row.entry_date),user.id,row.entry_date,row.fear_movement,row.before_score,row.after_score,row.context,row.support,now,now));
    if (row.journal && !existingCheckins.has(row.entry_date) && !existingFear.has(row.entry_date)) statements.push(db.prepare('INSERT OR IGNORE INTO micro_wins (id,user_id,entry_date,win,category,notes,gratitude,challenge,reframe,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(stableId(user.id,'win',row.entry_date),user.id,row.entry_date,row.win,'self_kindness',row.notes,row.gratitude,row.challenge,row.reframe,now,now));
  }
  // A single transaction keeps the import complete and safe to retry.
  if (statements.length) await db.batch(statements);
  return { email: user.email, start: rows[0].entry_date, end: through, generated_days: rows.length, inserted: statements.length, sample_data: true };
}
