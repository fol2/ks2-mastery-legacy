import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const previewPath = path.join(repoRoot, "preview.html");
const sentenceBankGlob = /^sentence-bank-\d+\.js$/i;
const outputPath = path.join(__dirname, "..", "src", "lib", "spelling", "generated-data.ts");

const ACCEPTED_ALTERNATIVES = {
  criticise: ["criticize"],
  recognise: ["recognize"],
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadRawWords() {
  const previewHtml = await fs.readFile(previewPath, "utf8");
  const startMarker = "const RAW_WORDS = ";
  const endMarker = "];\n    const SENTENCE_BANK =";
  const startIndex = previewHtml.indexOf(startMarker);
  const endIndex = previewHtml.indexOf(endMarker, startIndex);

  assert(startIndex >= 0 && endIndex > startIndex, "Could not find RAW_WORDS in preview.html");

  const jsonSource = previewHtml.slice(startIndex + startMarker.length, endIndex + 1);
  return JSON.parse(jsonSource);
}

async function loadSentenceBank() {
  const filenames = (await fs.readdir(repoRoot))
    .filter((name) => sentenceBankGlob.test(name))
    .sort();

  const sandbox = {
    window: {},
  };

  for (const filename of filenames) {
    const filePath = path.join(repoRoot, filename);
    const source = await fs.readFile(filePath, "utf8");
    vm.runInNewContext(source, sandbox, { filename });
  }

  return sandbox.window.KS2_SENTENCE_BANK ?? {};
}

function buildFamilyMap(rawWords) {
  const familyMap = new Map();

  for (const item of rawWords) {
    const key = `${item.year}||${item.family}`;
    const words = familyMap.get(key) ?? [];
    words.push(item.word);
    familyMap.set(key, words);
  }

  return familyMap;
}

function buildGeneratedWords(rawWords, sentenceBank) {
  const familyMap = buildFamilyMap(rawWords);

  return rawWords.map((item) => {
    const slug = String(item.word).toLowerCase();
    const familyKey = `${item.year}||${item.family}`;
    const bankSentences = Array.isArray(sentenceBank[slug]) ? sentenceBank[slug] : [];
    const legacySentences = Array.isArray(item.sentences) ? item.sentences : [];
    const sentences = [...bankSentences, ...legacySentences, item.sentence]
      .map((sentence) => String(sentence ?? "").trim())
      .filter(Boolean);

    return {
      year: item.year,
      yearLabel: item.year === "3-4" ? "Years 3-4" : "Years 5-6",
      family: item.family,
      familyWords: familyMap.get(familyKey) ?? [],
      word: item.word,
      slug,
      sentence: sentences[0] ?? "",
      sentences,
      accepted: [slug, ...(ACCEPTED_ALTERNATIVES[slug] ?? [])],
    };
  });
}

function serialiseTypescript(words) {
  return `import type { SpellingWord } from "./types";

export const GENERATED_SPELLING_WORDS: SpellingWord[] = ${JSON.stringify(words, null, 2)};
`;
}

async function main() {
  const [rawWords, sentenceBank] = await Promise.all([loadRawWords(), loadSentenceBank()]);
  const generatedWords = buildGeneratedWords(rawWords, sentenceBank);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, serialiseTypescript(generatedWords), "utf8");
  console.log(`Generated ${generatedWords.length} spelling words -> ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
