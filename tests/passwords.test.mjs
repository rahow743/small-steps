import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { openDatabase } from '../server/database.js';
import { handleApi } from '../server/api.js';
import { ownerCanSetupAdmin } from '../server/hosting.js';

const password = 'Test-only password with café 42!';
const origin = 'https://small-steps.test';
async function request(db, path, { method = 'GET', body, cookie, options } = {}) {
  const response = await handleApi(new Request(origin + path, {
    method, headers: { origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), db, options);
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
const signup = (db, email, options) => request(db, '/api/auth/signup', { method: 'POST', body: { name: 'Hosted auth test', email, password, timezone: 'Asia/Singapore', role: 'admin' }, options });
const login = (db, email, value = password) => request(db, '/api/auth/login', { method: 'POST', body: { email, password: value } });

describe('Hosted password compatibility', () => {
  it('requires the configured owner and verified platform identity for administrator setup', () => {
    const identity = { 'oai-authenticated-user-id': 'verified-owner-id', 'oai-authenticated-user-email': 'Owner@example.test' };
    assert.equal(ownerCanSetupAdmin(new Request(origin), 'owner@example.test'), false);
    assert.equal(ownerCanSetupAdmin(new Request(origin, { headers: identity })), false);
    assert.equal(ownerCanSetupAdmin(new Request(origin, { headers: { 'oai-authenticated-user-email': 'owner@example.test' } }), 'owner@example.test'), false);
    assert.equal(ownerCanSetupAdmin(new Request(origin, { headers: identity }), 'someone-else@example.test'), false);
    assert.equal(ownerCanSetupAdmin(new Request(origin, { headers: identity }), 'owner@example.test'), true);
  });
  it('signs up, signs in, changes a password, and saves progress under the production PBKDF2 cap', async () => {
    const db = openDatabase(':memory:');
    const nativePbkdf2 = crypto.pbkdf2Sync;
    const cap = mock.method(crypto, 'pbkdf2Sync', (...args) => {
      if (args[2] > 100000) throw Error('Pbkdf2 failed: iteration counts above 100000 are not supported');
      return nativePbkdf2(...args);
    });
    syncBuiltinESMExports();
    try {
      const created = await signup(db, 'hosted@example.test');
      assert.equal(created.status, 200); assert.equal(created.data.user.role, 'user');
      assert.match(created.headers.get('set-cookie'), /Secure/);
      const stored = db.prepare('SELECT password_hash FROM users WHERE id=?').bind(created.data.user.id).first();
      assert.match(stored.password_hash, /^scrypt-v2:32768:8:3:[a-f0-9]{32}:[a-f0-9]{128}$/);
      assert.equal((await login(db, 'missing@example.test')).status, 401);
      assert.equal((await login(db, 'hosted@example.test', 'An incorrect password')).status, 401);
      const signedIn = await login(db, 'hosted@example.test'); assert.equal(signedIn.status, 200);
      const changed = await request(db, '/api/password', { method: 'POST', cookie: signedIn.cookie, body: { current_password: password, new_password: 'Another test password 43!' } });
      assert.equal(changed.status, 200);
      assert.equal((await request(db, '/api/me', { cookie: signedIn.cookie })).status, 401);
      assert.equal((await login(db, 'hosted@example.test', 'Another test password 43!')).status, 200);
      const dashboard = await request(db, '/api/dashboard', { cookie: changed.cookie });
      assert.equal(dashboard.status, 200);
      const saved = await request(db, '/api/checkins', { method: 'POST', cookie: changed.cookie, body: { entry_date: dashboard.data.today, readiness: 7, fear: 3, movement: 'Turn left', mood: 'steady', win: 'A saved moment.', notes: '' } });
      assert.equal(saved.status, 200); assert.equal(saved.data.checkins[0].win, 'A saved moment.');
      assert.equal(cap.mock.callCount(), 0, 'New accounts and unknown-user verification must not use capped PBKDF2');
    } finally { cap.mock.restore(); syncBuiltinESMExports(); db.close(); }
  });

  it('keeps earlier local passwords working and upgrades them after successful login', async () => {
    const db = openDatabase(':memory:');
    try {
      const salt = '0123456789abcdef0123456789abcdef';
      const encodings = [
        'pbkdf2-sha256:600000:' + salt + ':' + crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex'),
        'scrypt:' + salt + ':' + crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString('hex'),
      ];
      for (const [index, encoded] of encodings.entries()) {
        const id = crypto.randomUUID(), email = `legacy-${index}@example.test`;
        db.prepare('INSERT INTO users (id,name,email,password_hash,role,timezone,created_at) VALUES (?,?,?,?,?,?,?)').bind(id, 'Earlier account', email, encoded, 'user', 'Asia/Singapore', new Date().toISOString()).run();
        assert.equal((await login(db, email, 'A wrong password')).status, 401);
        assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=?').bind(id).first().password_hash, encoded);
        assert.equal((await login(db, email)).status, 200);
        assert.match(db.prepare('SELECT password_hash FROM users WHERE id=?').bind(id).first().password_hash, /^scrypt-v2:32768:8:3:/);
        assert.equal((await login(db, email)).status, 200);
      }
    } finally { db.close(); }
  });

  it('reserves the first administrator for an authorized owner even after public members join', async () => {
    const db = openDatabase(':memory:');
    try {
      assert.equal((await signup(db, 'member@example.test')).data.user.role, 'user');
      assert.equal((await request(db, '/api/setup', { options: { allowAdminSignup: false } })).data.firstAccountIsAdmin, false);
      assert.equal((await request(db, '/api/setup', { options: { allowAdminSignup: true } })).data.firstAccountIsAdmin, true);
      assert.equal((await signup(db, 'owner@example.test', { allowAdminSignup: true })).data.user.role, 'admin');
      assert.equal((await signup(db, 'later@example.test', { allowAdminSignup: true })).data.user.role, 'user');
      assert.equal((await request(db, '/api/setup', { options: { allowAdminSignup: true } })).data.firstAccountIsAdmin, false);
    } finally { db.close(); }
  });
});
