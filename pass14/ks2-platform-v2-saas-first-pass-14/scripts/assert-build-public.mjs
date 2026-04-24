import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'dist', 'public');

async function mustExist(relativePath) {
  await access(path.join(publicDir, relativePath));
}

async function mustNotExist(relativePath) {
  try {
    await access(path.join(publicDir, relativePath));
  } catch {
    return;
  }
  throw new Error(`Unexpected deploy artefact in public output: ${relativePath}`);
}

async function walk(relativeDir = '') {
  const absoluteDir = path.join(publicDir, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

await mustExist('index.html');
await mustExist('_headers');
await mustExist('styles/app.css');
await mustExist('src/main.js');
await mustExist('worker/src/index.js').then(
  () => {
    throw new Error('Worker source must not be copied into public output.');
  },
  () => undefined,
);

for (const unsafePath of ['worker', 'tests', 'docs', 'legacy', 'migration-plan.md']) {
  await mustNotExist(unsafePath);
}
await mustNotExist('src/generated');

const topLevel = await readdir(publicDir);
const allowed = new Set(['_headers', 'index.html', 'styles', 'src', 'assets']);
const unexpected = topLevel.filter((entry) => !allowed.has(entry));
if (unexpected.length) {
  throw new Error(`Unexpected top-level public entries: ${unexpected.join(', ')}`);
}

const unsafeFiles = (await walk()).filter((file) => path.basename(file) === '.DS_Store');
if (unsafeFiles.length) {
  throw new Error(`Unexpected macOS metadata in public output: ${unsafeFiles.join(', ')}`);
}
