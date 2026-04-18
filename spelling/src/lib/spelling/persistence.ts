import { STORAGE_KEY } from "./constants";
import type { LearnerState } from "./types";

export function loadLearnerState(): LearnerState {
  if (typeof window === "undefined") {
    return { progress: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { progress: {} };
    }

    const parsed = JSON.parse(raw) as LearnerState | null;
    if (!parsed || typeof parsed !== "object" || !parsed.progress || typeof parsed.progress !== "object") {
      return { progress: {} };
    }

    return parsed;
  } catch {
    return { progress: {} };
  }
}

export function saveLearnerState(state: LearnerState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failures in best-effort local persistence.
  }
}

