import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSpellingContentSummary,
  normaliseSpellingContentBundle,
  resolvePublishedRelease,
  resolvePublishedSnapshot,
  validateSpellingContentBundle,
} from '../src/subjects/spelling/content/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const inputFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(rootDir, 'content', 'spelling.seed.json');
const outputFile = path.join(rootDir, 'src', 'subjects', 'spelling', 'data', 'content-data.js');
const runtimeFile = path.join(rootDir, 'src', 'subjects', 'spelling', 'data', 'word-data.js');

const raw = JSON.parse(await readFile(inputFile, 'utf8'));
const bundle = normaliseSpellingContentBundle(raw);
const validation = validateSpellingContentBundle(bundle);
if (!validation.ok) {
  const details = validation.errors.map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Spelling content validation failed.\n${details}`);
}

const release = resolvePublishedRelease(bundle, { fallbackToLatest: true });
const snapshot = resolvePublishedSnapshot(bundle);
if (!release || !snapshot) {
  throw new Error('A published spelling release is required before generating runtime data.');
}

const summary = buildSpellingContentSummary(bundle);
const moduleSource = `// Generated from ${path.relative(rootDir, inputFile)} via scripts/generate-spelling-content.mjs\n// Runtime reads are pinned to the published release snapshot, not the live draft payload.\n\nexport const SEEDED_SPELLING_CONTENT_BUNDLE = ${JSON.stringify(bundle, null, 2)};\n\nexport const SEEDED_SPELLING_PUBLISHED_RELEASE = ${JSON.stringify(release, null, 2)};\n\nexport const SEEDED_SPELLING_PUBLISHED_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};\n\nexport const SEEDED_SPELLING_CONTENT_SUMMARY = ${JSON.stringify(summary, null, 2)};\n`;
const runtimeSource = `// Generated from ${path.relative(rootDir, inputFile)} via scripts/generate-spelling-content.mjs\n// This file stays as a small compatibility shim for the existing spelling runtime.\n\nexport {\n  SEEDED_SPELLING_PUBLISHED_SNAPSHOT,\n} from './content-data.js';\n\nexport const WORDS = ${JSON.stringify(snapshot.words, null, 2)};\n\nexport const WORD_BY_SLUG = ${JSON.stringify(snapshot.wordBySlug, null, 2)};\n`;

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, moduleSource, 'utf8');
await writeFile(runtimeFile, runtimeSource, 'utf8');
console.log(`Generated ${path.relative(rootDir, outputFile)} and ${path.relative(rootDir, runtimeFile)}.`);
