PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  goal TEXT NOT NULL DEFAULT '',
  recovery_focus TEXT NOT NULL DEFAULT 'Building movement confidence',
  timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  readiness INTEGER NOT NULL CHECK(readiness BETWEEN 0 AND 10),
  fear INTEGER NOT NULL CHECK(fear BETWEEN 0 AND 10),
  movement TEXT NOT NULL,
  mood TEXT NOT NULL CHECK(mood IN ('hopeful', 'steady', 'unsure', 'low')),
  win TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS checkins_user_date ON checkins(user_id, entry_date DESC);
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  gratitude TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  reframe TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, entry_date)
);
CREATE INDEX IF NOT EXISTS reflections_user_date ON reflections(user_id, entry_date DESC);
CREATE TABLE IF NOT EXISTS milestones (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY(user_id, milestone_key)
);
CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fear_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  movement TEXT NOT NULL,
  before_score INTEGER NOT NULL CHECK(before_score BETWEEN 0 AND 10),
  after_score INTEGER CHECK(after_score BETWEEN 0 AND 10),
  context TEXT NOT NULL DEFAULT '',
  support TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fear_entries_user_date ON fear_entries(user_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS ladder_steps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expected_fear INTEGER NOT NULL CHECK(expected_fear BETWEEN 0 AND 10),
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'working', 'complete')),
  position INTEGER NOT NULL,
  completed_at TEXT,
  completed_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ladder_steps_user_position ON ladder_steps(user_id, position);

CREATE TABLE IF NOT EXISTS micro_wins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  win TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('courage', 'movement', 'self_kindness', 'gratitude', 'other')),
  notes TEXT NOT NULL DEFAULT '',
  gratitude TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  reframe TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS micro_wins_user_date ON micro_wins(user_id, entry_date DESC);
