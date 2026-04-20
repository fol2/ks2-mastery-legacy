import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSpellingContentSummary, extractPortableSpellingContent, validateSpellingContentBundle } from '../src/subjects/spelling/content/model.js';

const inputFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'content', 'spelling.seed.json');
const raw = JSON.parse(await readFile(inputFile, 'utf8'));
const bundle = extractPortableSpellingContent(raw);
const validation = validateSpellingContentBundle(bundle);
const summary = buildSpellingContentSummary(bundle);
console.log(JSON.stringify({ ok: validation.ok, summary, errors: validation.errors, warnings: validation.warnings }, null, 2));
if (!validation.ok) process.exitCode = 1;
