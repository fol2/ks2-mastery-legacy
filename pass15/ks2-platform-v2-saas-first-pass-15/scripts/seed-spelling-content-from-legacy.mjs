import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { normaliseSpellingContentBundle, publishSpellingContentBundle } from '../src/subjects/spelling/content/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const legacyDir = path.join(rootDir, 'legacy', 'vendor');
const outputFile = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(rootDir, 'content', 'spelling.seed.json');

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
const yearLists = [
  { id: 'statutory-y3-4', title: 'Years 3-4 statutory words', yearGroups: ['Y3', 'Y4'], tags: ['statutory', 'legacy-seed'], wordSlugs: [] },
  { id: 'statutory-y5-6', title: 'Years 5-6 statutory words', yearGroups: ['Y5', 'Y6'], tags: ['statutory', 'legacy-seed'], wordSlugs: [] },
];

const wordEntries = [];
const sentenceEntries = [];
for (const [wordIndex, word] of words.entries()) {
  const listId = word.year === '5-6' ? 'statutory-y5-6' : 'statutory-y3-4';
  const yearGroups = word.year === '5-6' ? ['Y5', 'Y6'] : ['Y3', 'Y4'];
  const sentenceIds = [];
  for (const [sentenceIndex, text] of (Array.isArray(word.sentences) ? word.sentences : []).entries()) {
    const sentenceId = `${word.slug}__${String(sentenceIndex + 1).padStart(2, '0')}`;
    sentenceIds.push(sentenceId);
    sentenceEntries.push({
      id: sentenceId,
      wordSlug: word.slug,
      text,
      variantLabel: sentenceIndex === 0 ? 'baseline' : `variant-${sentenceIndex + 1}`,
      tags: ['legacy-sentence-bank'],
      sourceNote: 'Seeded from preserved legacy sentence-bank files.',
      provenance: {
        source: 'legacy/vendor/sentence-bank-*.js',
        note: 'Per-sentence source file is not retained in the legacy aggregate bank.',
      },
      sortIndex: sentenceIndex,
    });
  }
  wordEntries.push({
    slug: word.slug,
    word: word.word,
    family: word.family,
    listId,
    yearGroups,
    tags: ['statutory', 'legacy-seed'],
    accepted: Array.isArray(word.accepted) ? word.accepted : [word.slug],
    sentenceEntryIds: sentenceIds,
    sourceNote: 'Seeded from preserved legacy spelling word list.',
    provenance: {
      source: 'legacy/vendor/word-list.js',
      note: 'Legacy vendor seed for Pass 11 content model.',
    },
    sortIndex: wordIndex,
  });
  const targetList = yearLists.find((entry) => entry.id === listId);
  targetList.wordSlugs.push(word.slug);
}

const baseBundle = normaliseSpellingContentBundle({
  modelVersion: 1,
  subjectId: 'spelling',
  draft: {
    id: 'main',
    state: 'draft',
    version: 1,
    title: 'Seeded spelling draft',
    notes: 'Generated from the preserved legacy spelling vendor files during Pass 11.',
    sourceNote: 'Legacy spelling seed',
    provenance: {
      source: 'legacy/vendor/*.js',
      note: 'Initial content seed produced for the content model pass.',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    wordLists: yearLists,
    words: wordEntries,
    sentences: sentenceEntries,
  },
  releases: [],
  publication: {},
});

const publishedBundle = publishSpellingContentBundle(baseBundle, {
  notes: 'Initial published baseline seeded from the preserved legacy spelling data.',
  title: 'Release 1',
  publishedAt: Date.now(),
});

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(publishedBundle, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputFile}`);
