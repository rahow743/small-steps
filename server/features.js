import { randomUUID } from 'node:crypto';

export async function loadFeatures(db, userId) {
  const [fear, ladder, wins] = await Promise.all([
    db.prepare('SELECT * FROM fear_entries WHERE user_id=? ORDER BY entry_date DESC, created_at DESC').bind(userId).all(),
    db.prepare('SELECT * FROM ladder_steps WHERE user_id=? ORDER BY position, created_at').bind(userId).all(),
    db.prepare('SELECT * FROM micro_wins WHERE user_id=? ORDER BY entry_date DESC, created_at DESC').bind(userId).all(),
  ]);
  return { fear_entries: fear.results, ladder_steps: ladder.results, micro_wins: wins.results };
}

export function monthWindows(today) {
  const [year, month, day] = today.split('-').map(Number);
  const previousStart = new Date(Date.UTC(year, month - 2, 1));
  const previousDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const previousEnd = new Date(Date.UTC(year, month - 2, Math.min(day, previousDays)));
  return {
    current: { start: today.slice(0, 8) + '01', end: today },
    previous: { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) },
  };
}

export function buildComparison(today, data) {
  const windows = monthWindows(today);
  const inWindow = (date, period) => Boolean(date && date >= period.start && date <= period.end);
  const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
  function summarize(period) {
    const checkins = data.checkins.filter(x => inWindow(x.entry_date, period));
    const reflections = data.reflections.filter(x => inWindow(x.entry_date, period));
    const wins = data.micro_wins.filter(x => inWindow(x.entry_date, period));
    const fear = data.fear_entries.filter(x => inWindow(x.entry_date, period));
    return {
      checkin_days: checkins.length,
      readiness: average(checkins.map(x => x.readiness)),
      fear: average(checkins.map(x => x.fear)),
      win_entries: wins.length + checkins.filter(x => x.win.trim()).length,
      gratitude_entries: reflections.filter(x => x.gratitude).length + wins.filter(x => x.gratitude).length,
      reframed_entries: reflections.filter(x => x.challenge && x.reframe).length + wins.filter(x => x.challenge && x.reframe).length,
      completed_steps: data.ladder_steps.filter(x => inWindow(x.completed_date, period)).length,
      fear_entries: fear.length,
      thermometer_before: average(fear.map(x => x.before_score)),
      thermometer_after: average(fear.filter(x => x.after_score !== null).map(x => x.after_score)),
    };
  }
  return { current: { ...windows.current, ...summarize(windows.current) }, previous: { ...windows.previous, ...summarize(windows.previous) } };
}

export async function mutateFeatures({ request, db, user, path, method, today, readBody, field, score, validDate, fail }) {
  const routes = { 'fear-entries': 'fear_entries', 'ladder-steps': 'ladder_steps', 'micro-wins': 'micro_wins' };
  if (path === '/api/ladder-steps/reorder' && method === 'POST') {
    const { ordered_ids: order } = await readBody(request);
    const current = (await db.prepare('SELECT id FROM ladder_steps WHERE user_id=?').bind(user.id).all()).results;
    const ids = new Set(current.map(x => x.id));
    if (!Array.isArray(order) || order.length !== ids.size || new Set(order).size !== order.length || !order.every(id => ids.has(id))) fail(400, 'Refresh your ladder and try reordering again.');
    if (order.length) await db.batch(order.map((id, position) => db.prepare('UPDATE ladder_steps SET position=?, updated_at=? WHERE id=? AND user_id=?').bind(position, new Date().toISOString(), id, user.id)));
    return true;
  }
  const match = /^\/api\/(fear-entries|ladder-steps|micro-wins)(?:\/([a-f0-9-]{36}))?$/.exec(path);
  if (!match || !['POST', 'PATCH', 'DELETE'].includes(method)) return false;
  const [, type, id] = match, table = routes[type];
  if ((method === 'POST' && id) || (method !== 'POST' && !id)) return false;
  const existing = id ? await db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).bind(id, user.id).first() : null;
  if (id && !existing) fail(404, 'This entry was not found in your account.');
  if (method === 'DELETE') {
    await db.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(id, user.id).run();
    return true;
  }
  const body = await readBody(request), now = new Date().toISOString();
  const value = (key, fallback = '') => Object.hasOwn(body, key) ? body[key] : (existing?.[key] ?? fallback);
  const recordId = id || randomUUID();
  if (type === 'fear-entries') {
    const date = validDate(value('entry_date'), user);
    const movement = field(value('movement'), 'Movement or situation', 120, true);
    const before = score(value('before_score'), 'Fear level');
    const afterValue = value('after_score', null);
    const after = afterValue === null ? null : score(afterValue, 'Afterwards fear level');
    const context = field(value('context'), 'Context', 500), support = field(value('support'), 'What helped', 1500);
    if (existing) await db.prepare('UPDATE fear_entries SET entry_date=?,movement=?,before_score=?,after_score=?,context=?,support=?,updated_at=? WHERE id=? AND user_id=?').bind(date, movement, before, after, context, support, now, id, user.id).run();
    else await db.prepare('INSERT INTO fear_entries (id,user_id,entry_date,movement,before_score,after_score,context,support,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(recordId, user.id, date, movement, before, after, context, support, now, now).run();
  } else if (type === 'ladder-steps') {
    const title = field(value('title'), 'Step title', 160, true), description = field(value('description'), 'Step description', 1500);
    const expected = score(value('expected_fear', 5), 'Expected fear level'), status = value('status', 'planned');
    if (!['planned', 'working', 'complete'].includes(status)) fail(400, 'Choose a valid step status.');
    const completedAt = status === 'complete' ? existing?.completed_at || now : null;
    const completedDate = status === 'complete' ? existing?.completed_date || today : null;
    if (existing) await db.prepare('UPDATE ladder_steps SET title=?,description=?,expected_fear=?,status=?,completed_at=?,completed_date=?,updated_at=? WHERE id=? AND user_id=?').bind(title, description, expected, status, completedAt, completedDate, now, id, user.id).run();
    else await db.prepare('INSERT INTO ladder_steps (id,user_id,title,description,expected_fear,status,position,completed_at,completed_date,created_at,updated_at) SELECT ?,?,?,?,?,?,COALESCE(MAX(position),-1)+1,?,?,?,? FROM ladder_steps WHERE user_id=?').bind(recordId, user.id, title, description, expected, status, completedAt, completedDate, now, now, user.id).run();
  } else {
    const date = validDate(value('entry_date'), user), win = field(value('win'), 'Small win', 500, true), category = value('category', 'other');
    if (!['courage', 'movement', 'self_kindness', 'gratitude', 'other'].includes(category)) fail(400, 'Choose a valid journal category.');
    const notes = field(value('notes'), 'Why it matters', 1500), gratitude = field(value('gratitude'), 'Gratitude', 1500);
    const challenge = field(value('challenge'), 'Difficult thought', 1500), reframe = field(value('reframe'), 'Kinder perspective', 1500);
    if (Boolean(challenge) !== Boolean(reframe)) fail(400, 'Complete both reframing fields, or leave both empty.');
    if (existing) await db.prepare('UPDATE micro_wins SET entry_date=?,win=?,category=?,notes=?,gratitude=?,challenge=?,reframe=?,updated_at=? WHERE id=? AND user_id=?').bind(date, win, category, notes, gratitude, challenge, reframe, now, id, user.id).run();
    else await db.prepare('INSERT INTO micro_wins (id,user_id,entry_date,win,category,notes,gratitude,challenge,reframe,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(recordId, user.id, date, win, category, notes, gratitude, challenge, reframe, now, now).run();
  }
  return true;
}
