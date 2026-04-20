import { WORD_BY_SLUG as DEFAULT_WORD_BY_SLUG } from './data/word-data.js';

export const SPELLING_EVENT_TYPES = Object.freeze({
  RETRY_CLEARED: 'spelling.retry-cleared',
  WORD_SECURED: 'spelling.word-secured',
  MASTERY_MILESTONE: 'spelling.mastery-milestone',
  SESSION_COMPLETED: 'spelling.session-completed',
});

export const SPELLING_MASTERY_MILESTONES = Object.freeze([1, 5, 10, 25, 50, 100, 150, 200]);

function safeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Date.now();
}

function wordFields(slug, wordMeta = DEFAULT_WORD_BY_SLUG) {
  const word = wordMeta[slug];
  if (!word) return null;
  return {
    wordSlug: word.slug,
    word: word.word,
    family: word.family,
    yearBand: word.year,
  };
}

function eventId(type, parts) {
  return [type, ...parts].map((part) => String(part ?? 'unknown')).join(':');
}

function baseSpellingEvent(type, payload = {}, idParts = []) {
  const createdAt = safeTimestamp(payload.createdAt);
  return {
    id: eventId(type, idParts),
    type,
    subjectId: 'spelling',
    learnerId: payload.learnerId || 'default',
    sessionId: payload.session?.id || payload.sessionId || null,
    mode: payload.session?.mode || payload.mode || null,
    createdAt,
  };
}

export function createSpellingRetryClearedEvent({ learnerId, session, slug, fromPhase, attemptCount = null, createdAt, wordMeta } = {}) {
  const word = wordFields(slug, wordMeta);
  if (!word) return null;
  if (!['retry', 'correction'].includes(fromPhase)) return null;

  return {
    ...baseSpellingEvent(
      SPELLING_EVENT_TYPES.RETRY_CLEARED,
      { learnerId, session, createdAt },
      [learnerId || 'default', session?.id || 'session', slug, fromPhase, Number.isInteger(attemptCount) ? attemptCount : 'na'],
    ),
    ...word,
    fromPhase,
    attemptCount: Number.isInteger(attemptCount) ? attemptCount : null,
  };
}

export function createSpellingWordSecuredEvent({ learnerId, session, slug, stage = null, createdAt, wordMeta } = {}) {
  const word = wordFields(slug, wordMeta);
  if (!word) return null;

  return {
    ...baseSpellingEvent(
      SPELLING_EVENT_TYPES.WORD_SECURED,
      { learnerId, session, createdAt },
      [learnerId || 'default', session?.id || 'session', slug, stage ?? 'secure'],
    ),
    ...word,
    stage: Number.isInteger(stage) ? stage : null,
  };
}

export function createSpellingMasteryMilestoneEvent({ learnerId, session, milestone, secureCount, createdAt } = {}) {
  const parsedMilestone = Number(milestone);
  if (!Number.isInteger(parsedMilestone) || parsedMilestone <= 0) return null;

  return {
    ...baseSpellingEvent(
      SPELLING_EVENT_TYPES.MASTERY_MILESTONE,
      { learnerId, session, createdAt },
      [learnerId || 'default', parsedMilestone],
    ),
    milestone: parsedMilestone,
    secureCount: Number.isInteger(Number(secureCount)) ? Number(secureCount) : parsedMilestone,
  };
}

export function createSpellingSessionCompletedEvent({ learnerId, session, summary, createdAt } = {}) {
  if (!session?.id) return null;
  return {
    ...baseSpellingEvent(
      SPELLING_EVENT_TYPES.SESSION_COMPLETED,
      { learnerId, session, createdAt },
      [learnerId || 'default', session.id],
    ),
    sessionType: session.type,
    totalWords: Array.isArray(session.uniqueWords) ? session.uniqueWords.length : 0,
    mistakeCount: Array.isArray(summary?.mistakes) ? summary.mistakes.length : 0,
  };
}
