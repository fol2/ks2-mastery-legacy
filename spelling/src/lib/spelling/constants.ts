export const STORAGE_KEY = "ks2-mastery-spelling-v1";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const STAGE_INTERVALS = [0, 1, 3, 7, 14, 30, 60] as const;
export const SECURE_STAGE = 4;
export const DEFAULT_SESSION_SIZE = 12;
export const TEST_SESSION_SIZE = 20;
export const AUDIO_CACHE_DB = "ks2-mastery-spelling-audio";
export const AUDIO_CACHE_STORE = "audio";
export const FORMAL_UK_PROMPT_VERSION = "uk-formal-v1";

export const GEMINI_TTS_VOICES = [
  ["Schedar", "Even"],
  ["Iapetus", "Clear"],
  ["Kore", "Firm"],
  ["Achird", "Friendly"],
  ["Sulafat", "Warm"],
] as const;

export type GeminiVoiceName = (typeof GEMINI_TTS_VOICES)[number][0];

export const DEFAULT_GEMINI_VOICE: GeminiVoiceName = "Schedar";
