export const SPELLING_SERVICE_STATE_VERSION = 1;

export const SPELLING_ROOT_PHASES = Object.freeze(['dashboard', 'session', 'summary']);
export const SPELLING_MODES = Object.freeze(['smart', 'trouble', 'test', 'single']);
export const SPELLING_YEAR_FILTERS = Object.freeze(['all', 'y3-4', 'y5-6']);
export const SPELLING_SESSION_TYPES = Object.freeze(['learning', 'test']);
export const SPELLING_SESSION_PHASES = Object.freeze(['question', 'retry', 'correction']);
export const SPELLING_FEEDBACK_KINDS = Object.freeze(['success', 'error', 'info', 'warn']);

export function createInitialSpellingState() {
  return {
    version: SPELLING_SERVICE_STATE_VERSION,
    phase: 'dashboard',
    session: null,
    feedback: null,
    summary: null,
    error: '',
    awaitingAdvance: false,
  };
}

export function defaultLearningStatus(needed = 1) {
  return {
    attempts: 0,
    successes: 0,
    needed,
    hadWrong: false,
    wrongAnswers: [],
    done: false,
    applied: false,
  };
}

export function normaliseMode(value, fallback = 'smart') {
  return SPELLING_MODES.includes(value) ? value : fallback;
}

export function normaliseYearFilter(value, fallback = 'all') {
  return SPELLING_YEAR_FILTERS.includes(value) ? value : fallback;
}

export function normaliseRoundLength(value, mode = 'smart') {
  if (mode === 'test') return 20;
  if (value === 'all') return 'all';
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '20';
}

export function normaliseBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  return fallback;
}

export function normaliseString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function normaliseOptionalString(value) {
  return typeof value === 'string' && value ? value : null;
}

export function normaliseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normaliseTimestamp(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normaliseStringArray(value, filterFn = null) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === 'string' && entry)
    .filter((entry) => (typeof filterFn === 'function' ? filterFn(entry) : true));
}

export function normaliseFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const feedback = {
    kind: SPELLING_FEEDBACK_KINDS.includes(value.kind) ? value.kind : 'info',
    headline: normaliseString(value.headline),
    answer: normaliseString(value.answer),
    body: normaliseString(value.body),
    footer: normaliseString(value.footer),
    familyWords: normaliseStringArray(value.familyWords),
  };

  if (!feedback.headline && !feedback.answer && !feedback.body && !feedback.footer && !feedback.familyWords.length) {
    return null;
  }

  return feedback;
}

export function normaliseSummaryCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return null;
  const label = normaliseString(card.label);
  const sub = normaliseString(card.sub);
  const value = typeof card.value === 'number' || typeof card.value === 'string'
    ? card.value
    : '';
  if (!label && value === '' && !sub) return null;
  return { label, value, sub };
}

export function normaliseSummary(value, isKnownSlug) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cards = Array.isArray(value.cards)
    ? value.cards.map(normaliseSummaryCard).filter(Boolean)
    : [];
  const mistakes = Array.isArray(value.mistakes)
    ? value.mistakes
        .map((word) => {
          if (!word || typeof word !== 'object' || Array.isArray(word)) return null;
          if (!isKnownSlug(word.slug)) return null;
          return {
            slug: word.slug,
            word: normaliseString(word.word),
            family: normaliseString(word.family),
            year: normaliseString(word.year),
            yearLabel: normaliseString(word.yearLabel),
            familyWords: normaliseStringArray(word.familyWords),
          };
        })
        .filter(Boolean)
    : [];
  return {
    mode: normaliseMode(value.mode, 'smart'),
    label: normaliseString(value.label, 'Spelling round'),
    message: normaliseString(value.message, 'Round complete.'),
    cards,
    mistakes,
    elapsedMs: normaliseNonNegativeInteger(value.elapsedMs, 0),
  };
}

export function normaliseStats(value) {
  const stats = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    total: normaliseNonNegativeInteger(stats.total, 0),
    secure: normaliseNonNegativeInteger(stats.secure, 0),
    due: normaliseNonNegativeInteger(stats.due, 0),
    fresh: normaliseNonNegativeInteger(stats.fresh, 0),
    trouble: normaliseNonNegativeInteger(stats.trouble, 0),
    attempts: normaliseNonNegativeInteger(stats.attempts, 0),
    correct: normaliseNonNegativeInteger(stats.correct, 0),
    accuracy: typeof stats.accuracy === 'number' || stats.accuracy === null
      ? stats.accuracy
      : null,
  };
}

export function cloneSerialisable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}
