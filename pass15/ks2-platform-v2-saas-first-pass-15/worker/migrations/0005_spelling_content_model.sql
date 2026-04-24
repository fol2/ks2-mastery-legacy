CREATE TABLE IF NOT EXISTS account_subject_content (
  account_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by_account_id TEXT NOT NULL,
  PRIMARY KEY (account_id, subject_id),
  FOREIGN KEY(account_id) REFERENCES adult_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_subject_content_subject
  ON account_subject_content(subject_id);
