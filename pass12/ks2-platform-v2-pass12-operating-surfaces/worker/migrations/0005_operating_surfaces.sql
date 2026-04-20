ALTER TABLE adult_accounts ADD COLUMN platform_role TEXT NOT NULL DEFAULT 'parent';

CREATE INDEX IF NOT EXISTS idx_mutation_receipts_account_applied
  ON mutation_receipts(account_id, applied_at DESC, request_id);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_learner_updated
  ON practice_sessions(learner_id, updated_at DESC, id DESC);
