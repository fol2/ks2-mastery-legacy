import { GENERATED_SPELLING_WORDS } from "./generated-data";
import type { SpellingWord } from "./types";

export const SPELLING_WORDS: SpellingWord[] = GENERATED_SPELLING_WORDS;

export const SPELLING_WORDS_BY_SLUG: Record<string, SpellingWord> = Object.fromEntries(
  SPELLING_WORDS.map((word) => [word.slug, word]),
);

export const OFFICIAL_SET_COUNT = new Set(
  SPELLING_WORDS.map((word) => `${word.year}||${word.family}`),
).size;

