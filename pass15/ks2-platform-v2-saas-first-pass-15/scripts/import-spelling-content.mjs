import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPortableSpellingContent, validateSpellingContentBundle } from '../src/subjects/spelling/content/model.js';

const inputFile = process.argv[2];
if (!inputFile) {
  throw new Error('Usage: node scripts/import-spelling-content.mjs <input.json> [output.json]');
}
const outputFile = process.argv[3]
  ? path.resolve(process.cwd(), process.argv[3])
  : path.resolve(process.cwd(), 'content', 'spelling.seed.json');
const raw = JSON.parse(await readFile(path.resolve(process.cwd(), inputFile), 'utf8'));
const bundle = extractPortableSpellingContent(raw);
const validation = validateSpellingContentBundle(bundle);
if (!validation.ok) {
  const message = validation.errors.map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Refusing to import invalid spelling content.\n${message}`);
}
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(validation.bundle, null, 2)}\n`, 'utf8');
console.log(`Imported spelling content into ${outputFile}`);
