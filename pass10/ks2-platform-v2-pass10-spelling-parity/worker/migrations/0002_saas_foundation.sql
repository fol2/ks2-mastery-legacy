PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_practice_sessions_learner_subject;
DROP INDEX IF EXISTS idx_reward_events_learner;
DROP INDEX IF EXISTS idx_learners_user;

DROP TABLE IF EXISTS reward_events;
DROP TABLE IF EXISTS child_subject_state;
DROP TABLE IF EXISTS child_game_state;
DROP TABLE IF EXISTS practice_sessions;
DROP TABLE IF EXISTS learners;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS adult_accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  selected_learner_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (selected_learner_id) REFERENCES learner_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year_group TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  goal TEXT NOT NULL,
  daily_minutes INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_learner_memberships (
  account_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  role TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, learner_id),
  FOREIGN KEY (account_id) REFERENCES adult_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  CHECK (role IN ('owner', 'member', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_account_learner_memberships_account
  ON account_learner_memberships(account_id, sort_index, learner_id);

CREATE INDEX IF NOT EXISTS idx_account_learner_memberships_learner
  ON account_learner_memberships(learner_id, role, account_id);

CREATE TABLE IF NOT EXISTS child_subject_state (
  learner_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  ui_json TEXT NOT NULL DEFAULT 'null',
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT,
  PRIMARY KEY (learner_id, subject_id),
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_account_id) REFERENCES adult_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  session_state_json TEXT,
  summary_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT,
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_account_id) REFERENCES adult_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_learner_subject
  ON practice_sessions(learner_id, subject_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS child_game_state (
  learner_id TEXT NOT NULL,
  system_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT,
  PRIMARY KEY (learner_id, system_id),
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_account_id) REFERENCES adult_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  learner_id TEXT,
  subject_id TEXT,
  system_id TEXT,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  actor_account_id TEXT,
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_account_id) REFERENCES adult_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_learner_created
  ON event_log(learner_id, created_at DESC, id DESC);
