ALTER TABLE adult_accounts ADD COLUMN repo_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE learner_profiles ADD COLUMN state_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mutation_receipts (
  account_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  mutation_kind TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  correlation_id TEXT,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, request_id),
  FOREIGN KEY (account_id) REFERENCES adult_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutation_receipts_scope
  ON mutation_receipts(account_id, scope_type, scope_id, applied_at DESC);
