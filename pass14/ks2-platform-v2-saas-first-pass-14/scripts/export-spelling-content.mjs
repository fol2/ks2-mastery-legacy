import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createPortableSpellingContentExport,
  normaliseSpellingContentBundle,
  validateSpellingContentBundle,
} from '../src/subjects/spelling/content/model.js';

const inputFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'content', 'spelling.seed.json');
const outputFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[3] || 'dist/spelling-content-export.json')
  : path.resolve(process.cwd(), 'dist', 'spelling-content-export.json');

const raw = JSON.parse(await readFile(inputFile, 'utf8'));
const bundle = normaliseSpellingContentBundle(raw);
const validation = validateSpellingContentBundle(bundle);
if (!validation.ok) {
  const message = validation.errors.map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Refusing to export invalid spelling content.\n${message}`);
}

const payload = createPortableSpellingContentExport(validation.bundle);
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Exported ${inputFile} -> ${outputFile}`);
