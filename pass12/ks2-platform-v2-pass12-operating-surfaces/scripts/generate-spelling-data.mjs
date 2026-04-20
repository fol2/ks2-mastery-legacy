import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const legacyDir = path.join(rootDir, 'legacy', 'vendor');
const outputFile = path.join(rootDir, 'src', 'subjects', 'spelling', 'data', 'word-data.js');

const sandbox = {
  window: {},
  console,
  Math,
  Date,
  crypto: globalThis.crypto,
};
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox.window;

const sourceFiles = [
  'sentence-bank-01.js',
  'sentence-bank-02.js',
  'sentence-bank-03.js',
  'sentence-bank-04.js',
  'sentence-bank-05.js',
  'sentence-bank-06.js',
  'word-list.js',
  'word-meta.js',
];

for (const relativePath of sourceFiles) {
  const source = await readFile(path.join(legacyDir, relativePath), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: relativePath });
}

const words = Array.isArray(sandbox.window.KS2_WORDS_ENRICHED) ? sandbox.window.KS2_WORDS_ENRICHED : [];
const bySlug = sandbox.window.KS2_WORD_META || {};

const moduleSource = `// Generated from legacy/vendor/*.js via scripts/generate-spelling-data.mjs\n// Source of truth remains the preserved vendor files.\n\nexport const WORDS = ${JSON.stringify(words, null, 2)};\n\nexport const WORD_BY_SLUG = ${JSON.stringify(bySlug, null, 2)};\n`;

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, moduleSource, 'utf8');
console.log(`Wrote ${outputFile} (${words.length} words)`);
