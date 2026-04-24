import { uid } from './utils.js';
import {
  cloneSerialisable,
  gameStateKey,
  normaliseEventLog,
  normaliseLearnerRecord,
  normaliseLearnersSnapshot,
  normalisePracticeSessionRecord,
  normaliseRepositoryBundle,
  normaliseSubjectStateRecord,
  parseGameStateKey,
  parseSubjectStateKey,
  REPO_SCHEMA_VERSION,
  subjectStateKey,
} from './repositories/index.js';

export const PLATFORM_EXPORT_VERSION = 1;
export const PLATFORM_EXPORT_KIND_APP = 'ks2-platform-data';
export const PLATFORM_EXPORT_KIND_LEARNER = 'ks2-platform-learner';
export const LEGACY_SPELLING_EXPORT_KIND = 'ks2-legacy-spelling-progress';

const LEGACY_SPELLING_STAGE_MAX = 6;
const LEGACY_SPELLING_DAY_MS = 24 * 60 * 60 * 1000;
const LEGACY_SPELLING_RESULTS = new Set(['correct', 'wrong']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readSubjectStatesBundle(repositories, learnerIds) {
  const subjectStates = {};
  for (const learnerId of learnerIds) {
    const scoped = repositories.subjectStates.readForLearner(learnerId);
    for (const [subjectId, record] of Object.entries(scoped || {})) {
      subjectStates[subjectStateKey(learnerId, subjectId)] = normaliseSubjectStateRecord(record);
    }
  }
  return subjectStates;
}

function readGameStateBundle(repositories, learnerIds) {
  const gameState = {};
  for (const learnerId of learnerIds) {
    const scoped = repositories.gameState.readForLearner(learnerId);
    for (const [systemId, state] of Object.entries(scoped || {})) {
      gameState[gameStateKey(learnerId, systemId)] = cloneSerialisable(state) || {};
    }
  }
  return gameState;
}

function bundleFromRepositories(repositories) {
  const learners = normaliseLearnersSnapshot(repositories.learners.read());
  const learnerIds = learners.allIds;
  return normaliseRepositoryBundle({
    meta: { version: REPO_SCHEMA_VERSION },
    learners,
    subjectStates: readSubjectStatesBundle(repositories, learnerIds),
    practiceSessions: repositories.practiceSessions.list(null),
    gameState: readGameStateBundle(repositories, learnerIds),
    eventLog: repositories.eventLog.list(),
  });
}

function bundleFromLegacyAppState(payload) {
  const learners = normaliseLearnersSnapshot(payload?.learners);
  const subjectStates = {};
  if (learners.selectedId && isPlainObject(payload?.subjectUi)) {
    for (const [subjectId, ui] of Object.entries(payload.subjectUi)) {
      subjectStates[subjectStateKey(learners.selectedId, subjectId)] = normaliseSubjectStateRecord({ ui, data: {}, updatedAt: 0 });
    }
  }
  return normaliseRepositoryBundle({
    meta: { version: REPO_SCHEMA_VERSION },
    learners,
    subjectStates,
    practiceSessions: [],
    gameState: {},
    eventLog: [],
  });
}

function looksLikePortableAppSnapshot(payload) {
  return payload?.kind === PLATFORM_EXPORT_KIND_APP && isPlainObject(payload.data);
}

function looksLikePortableLearnerSnapshot(payload) {
  return payload?.kind === PLATFORM_EXPORT_KIND_LEARNER && isPlainObject(payload.learner);
}

function unwrapLegacySpellingPayload(payload) {
  if (payload?.kind === LEGACY_SPELLING_EXPORT_KIND && isPlainObject(payload.data)) return payload.data;
  return payload;
}

function looksLikeLegacySpellingSnapshot(payload) {
  const candidate = unwrapLegacySpellingPayload(payload);
  return isPlainObject(candidate) && Array.isArray(candidate.profiles) && candidate.profiles.length > 0;
}

function looksLikeRepositoryBundle(payload) {
  return isPlainObject(payload) && (
    'learners' in payload
    || 'subjectStates' in payload
    || 'practiceSessions' in payload
    || 'gameState' in payload
    || 'eventLog' in payload
  );
}

function extractFullBundle(payload) {
  if (looksLikePortableAppSnapshot(payload)) {
    return normaliseRepositoryBundle(payload.data);
  }
  if (isPlainObject(payload) && 'learners' in payload && 'subjectUi' in payload && !('subjectStates' in payload)) {
    return bundleFromLegacyAppState(payload);
  }
  if (looksLikeRepositoryBundle(payload)) {
    return normaliseRepositoryBundle(payload);
  }
  return null;
}

function allocateImportedLearnerId(existingLearners, desiredId, createLearnerId) {
  if (!desiredId || !existingLearners.byId[desiredId]) return desiredId || createLearnerId('learner');
  let counter = 1;
  while (counter < 1000) {
    const candidate = `${desiredId}-import-${counter}`;
    if (!existingLearners.byId[candidate]) return candidate;
    counter += 1;
  }
  return createLearnerId('learner');
}

function clampInteger(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function todayDay() {
  return Math.floor(Date.now() / LEGACY_SPELLING_DAY_MS);
}

function normaliseLegacyProgressRecord(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    stage: clampInteger(raw.stage, 0, 0, LEGACY_SPELLING_STAGE_MAX),
    attempts: clampInteger(raw.attempts, 0),
    correct: clampInteger(raw.correct, 0),
    wrong: clampInteger(raw.wrong, 0),
    dueDay: clampInteger(raw.dueDay, todayDay()),
    lastDay: Number.isFinite(Number(raw.lastDay)) ? Math.trunc(Number(raw.lastDay)) : null,
    lastResult: LEGACY_SPELLING_RESULTS.has(raw.lastResult) ? raw.lastResult : null,
  };
}

function normaliseLegacyProgressMap(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [slug, progress] of Object.entries(raw)) {
    const key = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    if (!key) continue;
    output[key] = normaliseLegacyProgressRecord(progress);
  }
  return output;
}

function normaliseLegacySpellingProfiles(payload) {
  const state = unwrapLegacySpellingPayload(payload);
  const profiles = Array.isArray(state?.profiles) ? state.profiles : [];
  return profiles
    .filter(isPlainObject)
    .map((profile, index) => ({
      id: typeof profile.id === 'string' && profile.id ? profile.id : `legacy-spelling-${index + 1}`,
      name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : `Legacy learner ${index + 1}`,
      progress: normaliseLegacyProgressMap(profile.progress),
    }))
    .filter((profile) => Object.keys(profile.progress).length > 0 || profile.name);
}

function normaliseLearnerScopedSubjectStates(rawValue, learnerId) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [key, value] of Object.entries(raw)) {
    const parsed = parseSubjectStateKey(key);
    const subjectId = parsed?.subjectId || key;
    if (typeof subjectId !== 'string' || !subjectId) continue;
    output[subjectStateKey(learnerId, subjectId)] = normaliseSubjectStateRecord(value);
  }
  return output;
}

function normaliseLearnerScopedGameState(rawValue, learnerId) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [key, value] of Object.entries(raw)) {
    const parsed = parseGameStateKey(key);
    const systemId = parsed?.systemId || key;
    if (typeof systemId !== 'string' || !systemId) continue;
    output[gameStateKey(learnerId, systemId)] = isPlainObject(value) ? cloneSerialisable(value) : {};
  }
  return output;
}

function normaliseLearnerScopedSessions(rawValue, learnerId) {
  const input = Array.isArray(rawValue)
    ? rawValue
    : (isPlainObject(rawValue) ? Object.values(rawValue) : []);
  return input
    .map(normalisePracticeSessionRecord)
    .filter((record) => record.id && record.subjectId)
    .map((record) => ({
      ...record,
      learnerId,
    }));
}

function normaliseLearnerScopedEvents(rawValue, learnerId) {
  return normaliseEventLog(rawValue).map((event) => ({
    ...event,
    learnerId,
  }));
}

function importLegacySpellingSnapshot(repositories, payload, { createLearnerId } = {}) {
  const makeLearnerId = typeof createLearnerId === 'function'
    ? createLearnerId
    : (prefix = 'learner') => uid(prefix);
  const state = unwrapLegacySpellingPayload(payload);
  const profiles = normaliseLegacySpellingProfiles(payload);
  if (!profiles.length) {
    throw new TypeError('The legacy spelling export did not contain any learner profiles.');
  }

  const existingLearners = normaliseLearnersSnapshot(repositories.learners.read());
  const byId = { ...existingLearners.byId };
  const allIds = [...existingLearners.allIds];
  const idMap = {};
  const learnerIds = [];

  for (const profile of profiles) {
    const currentSnapshot = normaliseLearnersSnapshot({ byId, allIds, selectedId: existingLearners.selectedId });
    const targetLearnerId = allocateImportedLearnerId(currentSnapshot, profile.id, makeLearnerId);
    const learner = normaliseLearnerRecord({
      id: targetLearnerId,
      name: profile.name,
      yearGroup: 'Y5',
      goal: 'sats',
      dailyMinutes: 15,
      avatarColor: '#3E6FA8',
      createdAt: Date.now(),
    }, targetLearnerId);
    byId[targetLearnerId] = learner;
    if (!allIds.includes(targetLearnerId)) allIds.push(targetLearnerId);
    idMap[profile.id] = targetLearnerId;
    learnerIds.push(targetLearnerId);
  }

  const selectedId = idMap[state?.currentProfileId] || learnerIds[0] || existingLearners.selectedId;
  repositories.learners.write(normaliseLearnersSnapshot({ byId, allIds, selectedId }));

  const updatedAt = Date.now();
  for (const profile of profiles) {
    const learnerId = idMap[profile.id];
    repositories.subjectStates.writeRecord(learnerId, 'spelling', {
      ui: null,
      data: {
        progress: profile.progress,
        prefs: {},
      },
      updatedAt,
    });
  }

  return {
    kind: 'legacy-spelling',
    importedCount: learnerIds.length,
    learnerIds,
    selectedId,
    renamedIds: Object.fromEntries(
      Object.entries(idMap).filter(([sourceId, targetId]) => sourceId !== targetId),
    ),
  };
}

function writeBundleToRepositories(repositories, bundle) {
  repositories.clearAll();
  repositories.learners.write(bundle.learners);

  for (const [key, record] of Object.entries(bundle.subjectStates)) {
    const parsed = parseSubjectStateKey(key);
    if (!parsed) continue;
    repositories.subjectStates.writeRecord(parsed.learnerId, parsed.subjectId, record);
  }

  for (const record of bundle.practiceSessions) {
    repositories.practiceSessions.write(record);
  }

  for (const [key, state] of Object.entries(bundle.gameState)) {
    const parsed = parseGameStateKey(key);
    if (!parsed) continue;
    repositories.gameState.write(parsed.learnerId, parsed.systemId, state);
  }

  for (const event of bundle.eventLog) {
    repositories.eventLog.append(event);
  }
}

export function exportPlatformSnapshot(repositories) {
  return {
    kind: PLATFORM_EXPORT_KIND_APP,
    version: PLATFORM_EXPORT_VERSION,
    schemaVersion: REPO_SCHEMA_VERSION,
    exportedAt: Date.now(),
    data: bundleFromRepositories(repositories),
  };
}

export function exportLearnerSnapshot(repositories, learnerId) {
  const learners = normaliseLearnersSnapshot(repositories.learners.read());
  const learner = normaliseLearnerRecord(learners.byId[learnerId], learnerId);
  if (!learner) {
    throw new TypeError('Cannot export a learner snapshot without a valid learner id.');
  }

  return {
    kind: PLATFORM_EXPORT_KIND_LEARNER,
    version: PLATFORM_EXPORT_VERSION,
    schemaVersion: REPO_SCHEMA_VERSION,
    exportedAt: Date.now(),
    learner,
    subjectStates: repositories.subjectStates.readForLearner(learnerId),
    practiceSessions: repositories.practiceSessions.list(learnerId),
    gameState: repositories.gameState.readForLearner(learnerId),
    eventLog: repositories.eventLog.list(learnerId),
  };
}

export function importPlatformSnapshot(repositories, payload, { createLearnerId } = {}) {
  const makeLearnerId = typeof createLearnerId === 'function'
    ? createLearnerId
    : (prefix = 'learner') => uid(prefix);

  if (looksLikePortableLearnerSnapshot(payload)) {
    const existingLearners = normaliseLearnersSnapshot(repositories.learners.read());
    const sourceLearner = normaliseLearnerRecord(payload.learner, payload.learner?.id);
    if (!sourceLearner) {
      throw new TypeError('The learner snapshot did not contain a valid learner record.');
    }

    const targetLearnerId = allocateImportedLearnerId(existingLearners, sourceLearner.id, makeLearnerId);
    const importedLearner = { ...sourceLearner, id: targetLearnerId };
    const nextLearners = {
      byId: { ...existingLearners.byId, [targetLearnerId]: importedLearner },
      allIds: existingLearners.allIds.includes(targetLearnerId)
        ? existingLearners.allIds
        : [...existingLearners.allIds, targetLearnerId],
      selectedId: targetLearnerId,
    };

    repositories.learners.write(nextLearners);

    const subjectStates = normaliseLearnerScopedSubjectStates(payload.subjectStates, targetLearnerId);
    for (const [key, record] of Object.entries(subjectStates)) {
      const parsed = parseSubjectStateKey(key);
      repositories.subjectStates.writeRecord(parsed.learnerId, parsed.subjectId, record);
    }

    for (const record of normaliseLearnerScopedSessions(payload.practiceSessions, targetLearnerId)) {
      repositories.practiceSessions.write(record);
    }

    const gameState = normaliseLearnerScopedGameState(payload.gameState, targetLearnerId);
    for (const [key, state] of Object.entries(gameState)) {
      const parsed = parseGameStateKey(key);
      repositories.gameState.write(parsed.learnerId, parsed.systemId, state);
    }

    for (const event of normaliseLearnerScopedEvents(payload.eventLog, targetLearnerId)) {
      repositories.eventLog.append(event);
    }

    return {
      kind: 'learner',
      learnerId: targetLearnerId,
      renamed: targetLearnerId !== sourceLearner.id,
    };
  }

  if (looksLikeLegacySpellingSnapshot(payload)) {
    return importLegacySpellingSnapshot(repositories, payload, { createLearnerId: makeLearnerId });
  }

  const bundle = extractFullBundle(payload);
  if (!bundle) {
    throw new TypeError('The import JSON is not a recognised KS2 platform snapshot.');
  }

  writeBundleToRepositories(repositories, bundle);
  return {
    kind: 'app',
    learnerId: bundle.learners.selectedId,
    renamed: false,
  };
}
