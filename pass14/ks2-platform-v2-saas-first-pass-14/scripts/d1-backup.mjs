import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local') || !remote;
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(process.cwd(), 'backups', 'd1');
const outputFile = path.join(outputDir, `ks2-mastery-db-${remote ? 'remote' : 'local'}-${timestamp}.sql`);

mkdirSync(outputDir, { recursive: true });

const args = [
  'wrangler',
  'd1',
  'export',
  'ks2-mastery-db',
  local ? '--local' : '--remote',
  '--output',
  outputFile,
];

const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
