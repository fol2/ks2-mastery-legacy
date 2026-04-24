import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local') || !remote;

if (remote && process.env.KS2_CONFIRM_D1_RESET !== 'wipe-ks2-mastery-db') {
  console.error('Refusing remote D1 reset. Set KS2_CONFIRM_D1_RESET=wipe-ks2-mastery-db after taking a backup.');
  process.exit(1);
}

const resetSql = `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS account_credentials;
DROP TABLE IF EXISTS account_identities;
DROP TABLE IF EXISTS account_sessions;
DROP TABLE IF EXISTS request_limits;
DROP TABLE IF EXISTS mutation_receipts;
DROP TABLE IF EXISTS event_log;
DROP TABLE IF EXISTS child_game_state;
DROP TABLE IF EXISTS practice_sessions;
DROP TABLE IF EXISTS child_subject_state;
DROP TABLE IF EXISTS account_learner_memberships;
DROP TABLE IF EXISTS learner_profiles;
DROP TABLE IF EXISTS adult_accounts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS learners;
DROP TABLE IF EXISTS child_state;
DROP TABLE IF EXISTS spelling_sessions;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS user_identities;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS d1_migrations;
PRAGMA foreign_keys = ON;
`;

const sqlPath = path.join(os.tmpdir(), `ks2-d1-reset-${Date.now()}.sql`);
writeFileSync(sqlPath, resetSql, 'utf8');

const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;

const result = spawnSync('npx', [
  'wrangler',
  'd1',
  'execute',
  'ks2-mastery-db',
  local ? '--local' : '--remote',
  '--file',
  sqlPath,
], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
