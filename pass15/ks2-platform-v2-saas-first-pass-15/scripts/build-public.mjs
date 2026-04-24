import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist', 'public');
const tmpDir = path.join(rootDir, 'dist', 'public.tmp');

const entries = [
  '_headers',
  'index.html',
  'styles',
  'src',
  'assets',
];

const filterPublicFiles = source => {
  const base = path.basename(source);
  const relative = path.relative(rootDir, source).split(path.sep).join('/');

  if (base === '.DS_Store') {
    return false;
  }

  if (relative === 'src/generated' || relative.startsWith('src/generated/')) {
    return false;
  }

  return true;
};

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

for (const entry of entries) {
  await cp(path.join(rootDir, entry), path.join(tmpDir, entry), {
    recursive: true,
    force: true,
    filter: filterPublicFiles,
  });
}

await rm(outputDir, { recursive: true, force: true });
await cp(tmpDir, outputDir, { recursive: true, force: true });
await rm(tmpDir, { recursive: true, force: true });
