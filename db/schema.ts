import { sql } from 'drizzle-orm';
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

export const fearEntries = sqliteTable('fear_entries', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryDate: text('entry_date').notNull(), movement: text('movement').notNull(), beforeScore: integer('before_score').notNull(), afterScore: integer('after_score'),
  context: text('context').notNull().default(''), support: text('support').notNull().default(''), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('fear_entries_user_date').on(t.userId,t.entryDate),check('before_score_range',sql.raw('before_score BETWEEN 0 AND 10')),check('after_score_range',sql.raw('after_score BETWEEN 0 AND 10'))]);
export const ladderSteps = sqliteTable('ladder_steps', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), description: text('description').notNull().default(''), expectedFear: integer('expected_fear').notNull(),
  status: text('status').notNull().default('planned'), position: integer('position').notNull(), completedAt: text('completed_at'), completedDate: text('completed_date'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('ladder_steps_user_position').on(t.userId,t.position),check('expected_fear_range',sql.raw('expected_fear BETWEEN 0 AND 10')),check('ladder_status_values',sql.raw("status IN ('planned', 'working', 'complete')"))]);
export const microWins = sqliteTable('micro_wins', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryDate: text('entry_date').notNull(), win: text('win').notNull(), category: text('category').notNull().default('other'), notes: text('notes').notNull().default(''),
  gratitude: text('gratitude').notNull().default(''), challenge: text('challenge').notNull().default(''), reframe: text('reframe').notNull().default(''),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('micro_wins_user_date').on(t.userId,t.entryDate),check('win_category_values',sql.raw("category IN ('courage', 'movement', 'self_kindness', 'gratitude', 'other')"))]);
