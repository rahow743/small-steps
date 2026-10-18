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
