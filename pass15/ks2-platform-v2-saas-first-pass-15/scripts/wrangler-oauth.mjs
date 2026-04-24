import { spawnSync } from 'node:child_process';

const wranglerArgs = process.argv.slice(2);

if (!wranglerArgs.length) {
  console.error('Usage: node scripts/wrangler-oauth.mjs <wrangler args...>');
  process.exit(2);
}

const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;

const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxBin, ['wrangler', ...wranglerArgs], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
