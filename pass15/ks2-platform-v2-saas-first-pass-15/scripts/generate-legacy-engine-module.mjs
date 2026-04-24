import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const inputFile = path.join(rootDir, 'legacy', 'spelling-engine.source.js');
const outputFile = path.join(rootDir, 'src', 'subjects', 'spelling', 'engine', 'legacy-engine.js');

const source = await readFile(inputFile, 'utf8');

const wrapped = `// Generated from legacy/spelling-engine.source.js.\n// This is the preserved English Spelling engine, wrapped as a pure-ish factory\n// so the new platform can inject content, storage and TTS adapters cleanly.\n\nexport function createLegacySpellingEngine({ words, wordMeta, storage, tts, now = Date.now, random = Math.random } = {}) {\n  const Math = Object.create(globalThis.Math);\n  Math.random = typeof random === 'function' ? random : globalThis.Math.random;\n  const Date = class extends globalThis.Date {\n    static now() { return now(); }\n  };\n  const crypto = null;\n  const window = {\n    KS2_WORDS_ENRICHED: words || [],\n    KS2_WORD_META: wordMeta || {},\n    KS2_TTS: tts || null,\n    crypto,\n    Math,\n    Date,\n  };\n  const localStorage = storage || {\n    getItem() { return null; },\n    setItem() {},\n    removeItem() {},\n  };\n  try {\n${source.split('\n').map((line) => '    ' + line).join('\n')}\n    return window.SpellingEngine;\n  } finally {\n    // runtime randomness stays local to the injected Math facade above\n  }\n}\n`;

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, wrapped, 'utf8');
console.log(`Wrote ${outputFile}`);
