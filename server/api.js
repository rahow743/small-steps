import { randomBytes, randomUUID, createHash, scrypt, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { loadFeatures, buildComparison, mutateFeatures } from './features.js';

const deriveKey = promisify(scrypt);
// Synchronous derivation avoids Worker callback ownership across requests.
const derivePassword = (password, salt, iterations, length, digest) => pbkdf2Sync(password, salt, iterations, length, digest);
const SESSION_SECONDS = 604800;
const USER_FIELDS = 'id, name, email, role, goal, recovery_focus, timezone, created_at';
const MOVEMENTS = ['Not practised today', 'Side step', 'Turn left', 'Turn right', 'Pivot', 'Change direction', 'Other movement'];
export const MILESTONES = [
  { key: 'first-step', title: 'The first step', description: 'Make your first check-in. Showing up counts.', icon: 'footprints', target: 1, kind: 'checkins', xp: 25 },
  { key: 'three-days', title: 'Finding your rhythm', description: 'Check in on 3 days. They don’t have to be consecutive.', icon: 'sprout', target: 3, kind: 'checkins', xp: 50 },
  { key: 'gratitude', title: 'A little perspective', description: 'Write your first gratitude reflection.', icon: 'heart', target: 1, kind: 'gratitude', xp: 25 },
  { key: 'reframe', title: 'A kinder voice', description: 'Give a difficult thought a more balanced perspective.', icon: 'sun', target: 1, kind: 'reframe', xp: 25 },
  { key: 'courage', title: 'Courage looks like this', description: 'Reflect on a movement day when fear was present.', icon: 'shield', target: 1, kind: 'courage', xp: 50 },
  { key: 'seven-days', title: 'Your own pace', description: 'Check in on 7 different days, at your own pace.', icon: 'mountain', target: 7, kind: 'checkins', xp: 100 },
  { key: 'reflection-five', title: 'Room to grow', description: 'Make space for reflection on 5 different days.', icon: 'flower', target: 5, kind: 'reflections', xp: 75 },
  { key: 'fourteen-days', title: 'Small wins, big picture', description: 'Build a record of 14 check-in days.', icon: 'award', target: 14, kind: 'checkins', xp: 150 },
  { key: 'fear-awareness', title: 'Naming the feeling', description: 'Save your first fear thermometer entry.', icon: 'thermometer', target: 1, kind: 'fear_entries', xp: 25 },
  { key: 'first-ladder-step', title: 'One step closer', description: 'Complete a step on your own ladder.', icon: 'ladder', target: 1, kind: 'completed_steps', xp: 50 },
  { key: 'first-journal-win', title: 'A win worth keeping', description: 'Save a small win in your micro-win journal.', icon: 'book', target: 1, kind: 'micro_wins', xp: 25 },
];
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new ApiError(status, message); };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const hash = value => createHash('sha256').update(value).digest('hex');
const safeUser = user => Object.fromEntries(USER_FIELDS.split(', ').map(key => [key, user[key]]));
function field(value, label, max, required = false) {
  if (value !== undefined && typeof value !== 'string') fail(400, `${label} must be text.`);
  const result = (value ?? '').trim();
  if (required && !result) fail(400, `${label} is required.`);
  if (result.length > max) fail(400, `${label} must be ${max} characters or fewer.`);
  return result;
}
const score = (value, label) => { if (!Number.isInteger(value) || value < 0 || value > 10) fail(400, `${label} must be a whole number from 0 to 10.`); return value; };
export function todayIn(timezone, now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
function validDate(value, user) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Choose a valid date.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(400, 'Choose a valid date.');
  if (value > todayIn(user.timezone)) fail(400, 'You can’t record a future day.');
  if (value < '2000-01-01') fail(400, 'Choose a date from the year 2000 onwards.');
  return value;
}
function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 80) fail(400, 'Choose a valid time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); } catch { fail(400, 'Choose a valid time zone.'); }
  return value;
}
async function readBody(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) fail(415, 'Send this request as JSON.');
  const raw = await request.text();
  if (raw.length > 20000) fail(413, 'This entry is too large.');
  try { const result = JSON.parse(raw); if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error(); return result; }
  catch { fail(400, 'The request contains invalid JSON.'); }
}
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derivePassword(password, salt, 600000, 32, 'sha256');
  return `pbkdf2-sha256:600000:${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password, stored) {
  if (stored.startsWith('pbkdf2-sha256:')) {
    const [, iterations, salt, expected] = stored.split(':');
    const actual = await derivePassword(password, salt, Number(iterations), 32, 'sha256');
    return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  }
  // Preserve existing local accounts made with the earlier password format.
  const [, salt, expected] = stored.split(':');
  const actual = await deriveKey(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 });
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function validPassword(password) { if (typeof password !== 'string' || password.length < 10 || password.length > 128) fail(400, 'Use a password between 10 and 128 characters.'); return password; }
const cookie = (request, token, age = SESSION_SECONDS) => `smallsteps_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
const tokenOf = request => /(?:^|;\s*)smallsteps_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1];
async function makeSession(db, request, user) {
  const token = randomBytes(32).toString('hex');
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(hash(token), user.id, Date.now() + SESSION_SECONDS * 1000).run();
  return json({ user: safeUser(user) }, 200, { 'Set-Cookie': cookie(request, token) });
}
async function authenticated(db, request) {
  const token = tokenOf(request);
  if (!token) fail(401, 'Please sign in to continue.');
  const user = await db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?').bind(hash(token), Date.now()).first();
  if (!user) fail(401, 'Your session has expired. Please sign in again.');
  return user;
}
async function rateLimit(db, email) {
  const now = Date.now();
  await db.prepare('DELETE FROM auth_attempts WHERE resets_at < ?').bind(now).run();
  const attempt = await db.prepare('INSERT INTO auth_attempts (bucket, attempts, resets_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(hash(email), now + 900000).first();
  if (attempt.attempts > 15) fail(429, 'Too many attempts. Please try again in 15 minutes.');
}
export function milestoneProgress(checkins, reflections, features = { micro_wins: [], fear_entries: [], ladder_steps: [] }) {
  return { checkins: checkins.length, gratitude: reflections.filter(x => x.gratitude).length + features.micro_wins.filter(x => x.gratitude).length, reframe: reflections.filter(x => x.challenge && x.reframe).length + features.micro_wins.filter(x => x.challenge && x.reframe).length, courage: checkins.filter(x => x.fear > 0 && x.movement !== 'Not practised today' && x.win.trim()).length, reflections: new Set([...reflections, ...features.micro_wins].map(x => x.entry_date)).size, fear_entries: features.fear_entries.length, completed_steps: features.ladder_steps.filter(x => x.status === 'complete').length, micro_wins: features.micro_wins.length };
}
async function progressData(db, user, award = true) {
  const checkins = (await db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY entry_date DESC').bind(user.id).all()).results;
  const reflections = (await db.prepare('SELECT * FROM reflections WHERE user_id = ? ORDER BY entry_date DESC').bind(user.id).all()).results;
  const features = await loadFeatures(db, user.id);
  const progress = milestoneProgress(checkins, reflections, features);
  if (award) {
    const eligible = MILESTONES.filter(x => progress[x.kind] >= x.target);
    if (eligible.length) await db.batch(eligible.map(x => db.prepare('INSERT OR IGNORE INTO milestones (user_id, milestone_key, earned_at) VALUES (?, ?, ?)').bind(user.id, x.key, new Date().toISOString())));
  }
  const earned = (await db.prepare('SELECT milestone_key, earned_at FROM milestones WHERE user_id = ?').bind(user.id).all()).results;
  const milestones = MILESTONES.map(x => ({ ...x, progress: Math.min(progress[x.kind], x.target), earned_at: earned.find(row => row.milestone_key === x.key)?.earned_at || null }));
  const today = todayIn(user.timezone);
  return { user: safeUser(user), checkins, reflections, ...features, comparison: buildComparison(today, { checkins, reflections, ...features }), milestones, today, xp: milestones.filter(x => x.earned_at).reduce((sum, x) => sum + x.xp, 0) };
}

export async function handleApi(request, db, { network = null, allowAdminSignup = false, debugAuth = false } = {}) {
  try {
    const url = new URL(request.url), path = url.pathname.replace(/\/$/, ''), method = request.method;
    const trace = stage => { if (debugAuth && path.endsWith('/login')) console.info('[login] '+stage); };
    trace('request received');
    if (!['GET', 'HEAD'].includes(method)) {
      if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) fail(403, 'Please submit this form from the app.');
      if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Cross-site requests aren’t allowed.');
    }
    if (path === '/api/health' && method === 'GET') { await db.prepare('SELECT 1 AS ok').first(); return json({ status: 'ok', database: 'connected' }); }
    if (path === '/api/setup' && method === 'GET') {
      const { count } = await db.prepare('SELECT COUNT(*) AS count FROM users').first();
      return json({ setupRequired: count === 0, firstAccountIsAdmin: allowAdminSignup && count === 0 });
    }
    if (['/api/auth/signup', '/api/auth/login'].includes(path) && method === 'POST') {
      const body = await readBody(request), email = field(body.email, 'Email', 254, true).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      const password = validPassword(body.password);
      trace('valid input; checking attempt limit');
      await rateLimit(db, email);
      trace('attempt limit checked');
      if (path.endsWith('signup')) {
        const name = field(body.name, 'Name', 80, true), timezone = validTimezone(body.timezone || 'Asia/Singapore'), id = randomUUID();
        const encoded = await passwordHash(password);
        try {
          await db.prepare("INSERT INTO users (id, name, email, password_hash, role, timezone, created_at) SELECT ?, ?, ?, ?, CASE WHEN ? = 1 AND NOT EXISTS(SELECT 1 FROM users) THEN 'admin' ELSE 'user' END, ?, ?")
            .bind(id, name, email, encoded, allowAdminSignup ? 1 : 0, timezone, new Date().toISOString()).run();
        } catch (error) { if (/unique|constraint/i.test(String(error))) fail(409, 'An account already uses this email. Try signing in.'); throw error; }
        return await makeSession(db, request, await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first());
      }
      const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      trace('account read; verifying password');
      const matches = await passwordMatches(password, user?.password_hash || 'pbkdf2-sha256:600000:00000000000000000000000000000000:' + '00'.repeat(32));
      trace('password verification complete');
      if (!user || !matches) fail(401, 'The email or password is incorrect.');
      if (user.password_hash.startsWith('scrypt:')) await db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(password), user.id).run();
      trace('creating session');
      const response = await makeSession(db, request, user);
      trace('session created');
      return response;
    }
    const user = await authenticated(db, request);
    if (path === '/api/auth/logout' && method === 'POST') {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash(tokenOf(request))).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    }
    if (path === '/api/me' && method === 'GET') return json({ user: safeUser(user), network });
    if (path === '/api/dashboard' && method === 'GET') return json(await progressData(db, user));
    if (await mutateFeatures({ request, db, user, path, method, today: todayIn(user.timezone), readBody, field, score, validDate, fail })) return json(await progressData(db, user));
    if (path === '/api/checkins' && method === 'POST') {
      const body = await readBody(request), date = validDate(body.entry_date, user), readiness = score(body.readiness, 'Readiness'), fear = score(body.fear, 'Fear');
      if (!MOVEMENTS.includes(body.movement)) fail(400, 'Choose a movement from the list.');
      if (!['hopeful', 'steady', 'unsure', 'low'].includes(body.mood)) fail(400, 'Choose how you’re feeling today.');
      const win = field(body.win, 'Small win', 500), notes = field(body.notes, 'Notes', 1500), now = new Date().toISOString();
      await db.prepare('INSERT INTO checkins (id, user_id, entry_date, readiness, fear, movement, mood, win, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, entry_date) DO UPDATE SET readiness=excluded.readiness, fear=excluded.fear, movement=excluded.movement, mood=excluded.mood, win=excluded.win, notes=excluded.notes, updated_at=excluded.updated_at')
        .bind(randomUUID(), user.id, date, readiness, fear, body.movement, body.mood, win, notes, now, now).run();
      return json(await progressData(db, user));
    }
    if (path === '/api/reflections' && method === 'POST') {
      const body = await readBody(request), date = validDate(body.entry_date, user), gratitude = field(body.gratitude, 'Gratitude', 1500), challenge = field(body.challenge, 'Difficult thought', 1500), reframe = field(body.reframe, 'Reframe', 1500);
      if (!gratitude && !(challenge && reframe)) fail(400, 'Write something you’re grateful for, or complete both reframing fields.');
      if (Boolean(challenge) !== Boolean(reframe)) fail(400, 'Add both the difficult thought and a kinder perspective.');
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO reflections (id, user_id, entry_date, gratitude, challenge, reframe, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, entry_date) DO UPDATE SET gratitude=excluded.gratitude, challenge=excluded.challenge, reframe=excluded.reframe, updated_at=excluded.updated_at')
        .bind(randomUUID(), user.id, date, gratitude, challenge, reframe, now, now).run();
      return json(await progressData(db, user));
    }
    const deletion = /^\/api\/(checkins|reflections)\/([a-f0-9-]{36})$/.exec(path);
    if (deletion && method === 'DELETE') {
      const entry = await db.prepare(`SELECT id FROM ${deletion[1]} WHERE id = ? AND user_id = ?`).bind(deletion[2], user.id).first();
      if (!entry) fail(404, 'This entry wasn’t found.');
      await db.prepare(`DELETE FROM ${deletion[1]} WHERE id = ? AND user_id = ?`).bind(entry.id, user.id).run();
      return json(await progressData(db, user));
    }
    if (path === '/api/profile' && method === 'PATCH') {
      const body = await readBody(request), name = field(body.name, 'Name', 80, true), goal = field(body.goal, 'Personal goal', 500), focus = field(body.recovery_focus, 'Recovery focus', 120, true), timezone = validTimezone(body.timezone);
      await db.prepare('UPDATE users SET name=?, goal=?, recovery_focus=?, timezone=? WHERE id=?').bind(name, goal, focus, timezone, user.id).run();
      return json({ user: safeUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first()) });
    }
    if (path === '/api/password' && method === 'POST') {
      const body = await readBody(request); validPassword(body.current_password); validPassword(body.new_password); await rateLimit(db, user.email);
      if (!await passwordMatches(body.current_password, user.password_hash)) fail(400, 'Your current password is incorrect.');
      await db.batch([db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(body.new_password), user.id), db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
      return await makeSession(db, request, user);
    }
    if (path === '/api/export' && method === 'GET') return json(await progressData(db, user, false), 200, { 'Content-Disposition': 'attachment; filename="small-steps-data.json"' });
    if (path.startsWith('/api/admin/')) {
      if (user.role !== 'admin') fail(403, 'This page is only available to administrators.');
      if (path === '/api/admin/users' && method === 'GET') {
        const users = (await db.prepare(`SELECT ${USER_FIELDS.split(', ').map(key => 'u.' + key).join(', ')},
          (SELECT COUNT(*) FROM checkins c WHERE c.user_id=u.id) AS checkin_count,
          (SELECT COUNT(*) FROM reflections r WHERE r.user_id=u.id) AS reflection_count,
          (SELECT readiness FROM checkins c WHERE c.user_id=u.id ORDER BY entry_date DESC LIMIT 1) AS latest_readiness,
          (SELECT fear FROM checkins c WHERE c.user_id=u.id ORDER BY entry_date DESC LIMIT 1) AS latest_fear,
          (SELECT MAX(entry_date) FROM checkins c WHERE c.user_id=u.id) AS last_checkin FROM users u ORDER BY u.created_at DESC`).all()).results;
        return json({ users });
      }
      const detail = /^\/api\/admin\/users\/([a-f0-9-]{36})$/.exec(path);
      if (detail && method === 'GET') {
        const target = await db.prepare('SELECT * FROM users WHERE id=?').bind(detail[1]).first();
        if (!target) fail(404, 'This account wasn’t found.');
        return json(await progressData(db, target, false));
      }
    }
    fail(404, 'This page or action wasn’t found.');
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error('API failure:', error.message);
    return json({ error: 'Something went wrong while saving your information. Please try again.' }, 500);
  }
}
