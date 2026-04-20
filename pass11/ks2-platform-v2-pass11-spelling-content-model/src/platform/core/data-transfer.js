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
