export type YearBand = "3-4" | "5-6";

export interface SpellingWord {
  year: YearBand;
  yearLabel: string;
  family: string;
  familyWords: string[];
  word: string;
  slug: string;
  sentence: string;
  sentences: string[];
  accepted: string[];
}

export interface WordProgress {
  stage: number;
  attempts: number;
  correct: number;
  wrong: number;
  dueDay: number;
  lastDay: number | null;
  lastResult: "correct" | "wrong" | null;
}

export interface LearnerState {
  progress: Record<string, WordProgress>;
}

export interface PromptState {
  slug: string;
  sentence: string;
  cloze: string;
}

export interface SentenceHistory {
  remaining: number[];
  lastIndex: number | null;
}

export interface SessionWordStatus {
  attempts: number;
  successes: number;
  needed: number;
  hadWrong: boolean;
  wrongAnswers: string[];
  done: boolean;
  applied: boolean;
}

export interface SessionSummaryCard {
  label: string;
  value: string | number;
  sub: string;
}

export interface SessionSummary {
  title: string;
  cards: SessionSummaryCard[];
  text: string;
  mistakes: string[];
}

export type LearningMode = "smart" | "trouble" | "single";
export type SessionPhase = "question" | "retry" | "correction";

export interface LearningSession {
  type: "learning";
  mode: LearningMode;
  label: string;
  uniqueWords: string[];
  queue: string[];
  status: Record<string, SessionWordStatus>;
  currentSlug: string | null;
  currentPrompt: PromptState | null;
  sentenceHistory: Record<string, SentenceHistory>;
  phase: SessionPhase;
  promptCount: number;
  lastFamily: string | null;
  lastYear: YearBand | null;
  notes: {
    description: string;
    hint: string;
    footer: string;
  };
}

export interface TestResult {
  slug: string;
  answer: string;
  correct: boolean;
}

export interface TestSession {
  type: "test";
  mode: "test";
  label: string;
  uniqueWords: string[];
  queue: string[];
  currentSlug: string | null;
  currentPrompt: PromptState | null;
  sentenceHistory: Record<string, SentenceHistory>;
  results: TestResult[];
  notes: {
    description: string;
    hint: string;
    footer: string;
  };
}

export type PracticeSession = LearningSession | TestSession;

export interface PracticeStats {
  officialSets: number;
  practiceSpellings: number;
  secure: number;
  dueToday: number;
  newLeft: number;
  accuracy: number | null;
  attempts: number;
}

export interface LiveStats {
  secure: number;
  due: number;
  trouble: number;
  bankSize: number;
}

export interface LearningSubmitResult {
  kind: "correct" | "retry" | "correction" | "locked-in" | "done";
  tone: "success" | "info" | "error";
  title: string;
  message: string;
  answer?: string;
  summary?: SessionSummary;
}

export interface TestSubmitResult {
  kind: "saved" | "done";
  tone: "info" | "success";
  title: string;
  message: string;
  summary?: SessionSummary;
}

export interface AudioRequest {
  word: string;
  sentence: string;
  slow: boolean;
  voiceName: string;
}

export type AudioEngine = "gemini" | "browser";

export interface AudioCacheEntry {
  cacheKey: string;
  blob: Blob;
  createdAt: number;
}
