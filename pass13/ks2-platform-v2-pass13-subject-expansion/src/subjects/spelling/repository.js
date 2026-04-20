import { cloneSerialisable, normalisePracticeSessionRecord } from '../../platform/core/repositories/helpers.js';

const SUBJECT_ID = 'spelling';
const PREF_STORAGE_PREFIX = 'ks2-platform-v2.spelling-prefs.';
const PROGRESS_STORAGE_PREFIX = 'ks2-spell-progress-';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function timestamp(now = Date.now) {
  const value = typeof now === 'function' ? Number(now()) : Date.now();
  return Number.isFinite(value) ? value : Date.now();
}

function progressKey(learnerId) {
  return `${PROGRESS_STORAGE_PREFIX}${learnerId || 'default'}`;
}

function prefsKey(learnerId) {
  return `${PREF_STORAGE_PREFIX}${learnerId || 'default'}`;
}

function parseStorageKey(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith(PREF_STORAGE_PREFIX)) {
    return { type: 'prefs', learnerId: key.slice(PREF_STORAGE_PREFIX.length) || 'default' };
  }
  if (key.startsWith(PROGRESS_STORAGE_PREFIX)) {
    return { type: 'progress', learnerId: key.slice(PROGRESS_STORAGE_PREFIX.length) || 'default' };
  }
  return null;
}

function parseStoredJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : cloneSerialisable(fallback);
  } catch {
    return cloneSerialisable(fallback);
  }
}

function normaliseProgressMap(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [slug, entry] of Object.entries(raw)) {
    if (!slug || !isPlainObject(entry)) continue;
    output[slug] = cloneSerialisable(entry);
  }
  return output;
}

export function normaliseSpellingSubjectData(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    prefs: isPlainObject(raw.prefs) ? cloneSerialisable(raw.prefs) : {},
    progress: normaliseProgressMap(raw.progress),
  };
}

function readSpellingData(repositories, learnerId) {
  return normaliseSpellingSubjectData(repositories.subjectStates.read(learnerId, SUBJECT_ID).data || {});
}

function writeSpellingData(repositories, learnerId, nextData) {
  return normaliseSpellingSubjectData(
    repositories.subjectStates.writeData(learnerId, SUBJECT_ID, normaliseSpellingSubjectData(nextData)).data,
  );
}

function buildActiveRecord(learnerId, state, now) {
  const session = state?.session;
  if (!session) return null;
  return normalisePracticeSessionRecord({
    id: session.id,
    learnerId,
    subjectId: SUBJECT_ID,
    sessionKind: session.type,
    status: 'active',
    sessionState: cloneSerialisable(session),
    summary: null,
    createdAt: session.startedAt || timestamp(now),
    updatedAt: timestamp(now),
  });
}

function buildCompletedRecord(learnerId, state, repositories, now) {
  const summary = state?.summary;
  if (!summary) return null;
  const latest = repositories.practiceSessions.latest(learnerId, SUBJECT_ID);
  return normalisePracticeSessionRecord({
    id: latest?.id || `spelling-${timestamp(now)}`,
    learnerId,
    subjectId: SUBJECT_ID,
    sessionKind: latest?.sessionKind || summary.mode || 'practice',
    status: 'completed',
    sessionState: null,
    summary: cloneSerialisable(summary),
    createdAt: latest?.createdAt || timestamp(now),
    updatedAt: timestamp(now),
  });
}

export function createSpellingPersistence({ repositories, now } = {}) {
  if (!repositories) {
    throw new TypeError('Spelling persistence requires platform repositories.');
  }

  const storage = {
    getItem(key) {
      const parsed = parseStorageKey(key);
      if (!parsed) return null;
      const data = readSpellingData(repositories, parsed.learnerId);
      if (parsed.type === 'prefs') return JSON.stringify(data.prefs || {});
      if (parsed.type === 'progress') return JSON.stringify(data.progress || {});
      return null;
    },
    setItem(key, value) {
      const parsed = parseStorageKey(key);
      if (!parsed) return;
      const current = readSpellingData(repositories, parsed.learnerId);
      if (parsed.type === 'prefs') {
        writeSpellingData(repositories, parsed.learnerId, {
          ...current,
          prefs: parseStoredJson(value, {}),
        });
      }
      if (parsed.type === 'progress') {
        writeSpellingData(repositories, parsed.learnerId, {
          ...current,
          progress: parseStoredJson(value, {}),
        });
      }
    },
    removeItem(key) {
      const parsed = parseStorageKey(key);
      if (!parsed) return;
      const current = readSpellingData(repositories, parsed.learnerId);
      if (parsed.type === 'prefs') {
        writeSpellingData(repositories, parsed.learnerId, {
          ...current,
          prefs: {},
        });
      }
      if (parsed.type === 'progress') {
        writeSpellingData(repositories, parsed.learnerId, {
          ...current,
          progress: {},
        });
      }
    },
  };

  return {
    storage,
    progressKey,
    prefsKey,
    syncPracticeSession(learnerId, state) {
      if (state?.phase === 'session') {
        const record = buildActiveRecord(learnerId, state, now);
        if (record) repositories.practiceSessions.write(record);
        return record;
      }
      if (state?.phase === 'summary') {
        const record = buildCompletedRecord(learnerId, state, repositories, now);
        if (record) repositories.practiceSessions.write(record);
        return record;
      }
      repositories.practiceSessions.clear(learnerId, SUBJECT_ID);
      return null;
    },
    abandonPracticeSession(learnerId, rawState) {
      const sessionId = rawState?.session?.id;
      const latest = repositories.practiceSessions.latest(learnerId, SUBJECT_ID);
      if (!latest || (sessionId && latest.id !== sessionId)) return null;
      const next = normalisePracticeSessionRecord({
        ...latest,
        status: 'abandoned',
        updatedAt: timestamp(now),
      });
      repositories.practiceSessions.write(next);
      return next;
    },
    resetLearner(learnerId) {
      writeSpellingData(repositories, learnerId, {});
      repositories.practiceSessions.clear(learnerId, SUBJECT_ID);
    },
  };
}
