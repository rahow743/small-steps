// Keep the portable JavaScript app and hosted Sites adapter on the same API.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const write = (name, content) => { mkdirSync(dirname(resolve(name)), { recursive: true }); writeFileSync(name, content.trimStart()); };
write('app/page.tsx', `import Script from 'next/script';
export default function Home() {
  return <>
    <div id="app" aria-live="polite"><div className="initial-loading"><span className="loading-mark">s.</span><p>Making room for your small wins…</p></div></div>
    <div id="toast" role="status" aria-live="polite" />
    <dialog id="modal" />
    <noscript>Small Steps needs JavaScript enabled to sign in and save your progress.</noscript>
    <Script src="/app.js" type="module" strategy="afterInteractive" />
  </>;
}
`);
write('app/layout.tsx', `import type { Metadata } from 'next';
import '../public/app.css';
export const metadata: Metadata = {
  title: 'Small Steps — Your progress, at your pace',
  description: 'Celebrate every small win. Track psychological readiness, movement confidence, gratitude, and personal milestones.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
`);
write('app/api/[...path]/route.js', `import { env } from 'cloudflare:workers';
import { handleApi } from '../../../server/api.js';
export const dynamic = 'force-dynamic';
// Sites keeps its outer ChatGPT access boundary alongside the requested app login.
const handle = request => handleApi(request, env.DB, {
  allowAdminSignup: Boolean(request.headers.get('oai-authenticated-user-id')),
});
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
`);
write('db/schema.ts', `import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, check } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), role: text('role').notNull().default('user'),
  goal: text('goal').notNull().default(''), recoveryFocus: text('recovery_focus').notNull().default('Building movement confidence'),
  timezone: text('timezone').notNull().default('Asia/Singapore'), createdAt: text('created_at').notNull(),
}, () => [check('users_role', sql.raw("role IN ('user', 'admin')"))]);
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), expiresAt: integer('expires_at').notNull(),
}, t => [index('sessions_expiry').on(t.expiresAt)]);
export const checkins = sqliteTable('checkins', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryDate: text('entry_date').notNull(), readiness: integer('readiness').notNull(), fear: integer('fear').notNull(), movement: text('movement').notNull(), mood: text('mood').notNull(),
  win: text('win').notNull().default(''), notes: text('notes').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('checkins_user_day').on(t.userId,t.entryDate),index('checkins_user_date').on(t.userId,t.entryDate),check('readiness_range',sql.raw('readiness BETWEEN 0 AND 10')),check('fear_range',sql.raw('fear BETWEEN 0 AND 10')),check('mood_values',sql.raw("mood IN ('hopeful', 'steady', 'unsure', 'low')"))]);
export const reflections = sqliteTable('reflections', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), entryDate: text('entry_date').notNull(),
  gratitude: text('gratitude').notNull().default(''), challenge: text('challenge').notNull().default(''), reframe: text('reframe').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('reflections_user_day').on(t.userId,t.entryDate),index('reflections_user_date').on(t.userId,t.entryDate)]);
export const milestones = sqliteTable('milestones', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), milestoneKey: text('milestone_key').notNull(), earnedAt: text('earned_at').notNull(),
}, t => [primaryKey({ columns: [t.userId,t.milestoneKey] })]);
export const authAttempts = sqliteTable('auth_attempts', { bucket: text('bucket').primaryKey(), attempts: integer('attempts').notNull(), resetsAt: integer('resets_at').notNull() });
`);
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
hosting.d1 = 'DB';
write('.openai/hosting.json', JSON.stringify(hosting, null, 2) + '\n');
const ignore = readFileSync('.gitignore', 'utf8');
if (!ignore.includes('/data/')) write('.gitignore', ignore + '\n/data/\n/.test-data/\n*.tsbuildinfo\n');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.name = 'small-steps';
pkg.scripts['preview:hosted'] = pkg.scripts['preview:hosted'] || pkg.scripts.start;
pkg.scripts.start = 'node server/local.js';
pkg.scripts.admin = 'node scripts/make-admin.mjs';
pkg.scripts.test = 'node --test tests/api.test.mjs';
pkg.scripts['test:browser'] = 'node scripts/browser-qa.mjs';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
lock.name = 'small-steps'; lock.packages[''].name = 'small-steps';
write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log('Hosted adapter, schema, and project commands are ready.');
