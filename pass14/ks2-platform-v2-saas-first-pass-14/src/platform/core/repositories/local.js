import {
  cloneSerialisable,
  currentRepositoryMeta,
  emptyLearnersSnapshot,
  emptySubjectStateRecord,
  filterSessions,
  gameStateKey,
  loadCollection,
  mergeSubjectData,
  mergeSubjectUi,
  normaliseLearnersSnapshot,
  normalisePracticeSessionRecord,
  normaliseRepositoryBundle,
  normaliseSubjectStateRecord,
  nowTs,
  parseGameStateKey,
  practiceSessionKey,
  removeCollection,
  REPO_STORAGE_KEYS,
  subjectStateKey,
} from './helpers.js';
import {
  createPersistenceChannel,
  createPersistenceError,
  defaultPersistenceSnapshot,
  PERSISTENCE_CACHE_STATES,
  PERSISTENCE_MODES,
  PERSISTENCE_TRUSTED_STATES,
} from './persistence.js';
import { validatePlatformRepositories } from './contract.js';

const LEGACY_KEYS = Object.freeze({
  appState: 'ks2-platform-v2.app-state',
  spellingPrefsPrefix: 'ks2-platform-v2.spelling-prefs.',
  spellingProgressPrefix: 'ks2-spell-progress-',
  monstersPrefix: 'ks2-platform-v2.monsters.',
});

function createNoopStorage() {
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    key() { return null; },
    get length() { return 0; },
  };
}

function storageKeys(storage) {
  const keys = [];
  const total = Number(storage?.length) || 0;
  for (let index = 0; index < total; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}

function hasNewRepositoryData(storage) {
  return [
    REPO_STORAGE_KEYS.learners,
    REPO_STORAGE_KEYS.subjectStates,
    REPO_STORAGE_KEYS.practiceSessions,
    REPO_STORAGE_KEYS.gameState,
    REPO_STORAGE_KEYS.eventLog,
  ].some((key) => Boolean(storage?.getItem?.(key)));
}

function loadLegacySeed(storage) {
  const learners = emptyLearnersSnapshot();
  const subjectStates = {};
  const practiceSessions = [];
  const gameState = {};
  const eventLog = [];

  const appState = loadCollection(storage, LEGACY_KEYS.appState, null);
  if (appState?.learners) {
    const normalised = normaliseLearnersSnapshot(appState.learners);
    learners.byId = normalised.byId;
    learners.allIds = normalised.allIds;
    learners.selectedId = normalised.selectedId;

    if (learners.selectedId && appState.subjectUi && typeof appState.subjectUi === 'object') {
      for (const [subjectId, ui] of Object.entries(appState.subjectUi)) {
        subjectStates[subjectStateKey(learners.selectedId, subjectId)] = {
          ...emptySubjectStateRecord(),
          ui: cloneSerialisable(ui),
          updatedAt: Date.now(),
        };
      }
    }
  }

  for (const key of storageKeys(storage)) {
    if (key.startsWith(LEGACY_KEYS.spellingPrefsPrefix)) {
      const learnerId = key.slice(LEGACY_KEYS.spellingPrefsPrefix.length);
      const currentKey = subjectStateKey(learnerId, 'spelling');
      const record = subjectStates[currentKey] || emptySubjectStateRecord();
      subjectStates[currentKey] = mergeSubjectData(record, {
        ...(record.data || {}),
        prefs: loadCollection(storage, key, {}),
      }, Date.now());
    }

    if (key.startsWith(LEGACY_KEYS.spellingProgressPrefix)) {
      const learnerId = key.slice(LEGACY_KEYS.spellingProgressPrefix.length);
      const currentKey = subjectStateKey(learnerId, 'spelling');
      const record = subjectStates[currentKey] || emptySubjectStateRecord();
      subjectStates[currentKey] = mergeSubjectData(record, {
        ...(record.data || {}),
        progress: loadCollection(storage, key, {}),
      }, Date.now());
    }

    if (key.startsWith(LEGACY_KEYS.monstersPrefix)) {
      const learnerId = key.slice(LEGACY_KEYS.monstersPrefix.length);
      gameState[gameStateKey(learnerId, 'monster-codex')] = cloneSerialisable(loadCollection(storage, key, {}));
    }
  }

  return {
    learners,
    subjectStates,
    practiceSessions,
    gameState,
    eventLog,
  };
}

function persistBundle(storage, bundle) {
  try {
    storage?.setItem?.(REPO_STORAGE_KEYS.meta, JSON.stringify(bundle.meta));
    storage?.setItem?.(REPO_STORAGE_KEYS.learners, JSON.stringify(bundle.learners));
    storage?.setItem?.(REPO_STORAGE_KEYS.subjectStates, JSON.stringify(bundle.subjectStates));
    storage?.setItem?.(REPO_STORAGE_KEYS.practiceSessions, JSON.stringify(bundle.practiceSessions));
    storage?.setItem?.(REPO_STORAGE_KEYS.gameState, JSON.stringify(bundle.gameState));
    storage?.setItem?.(REPO_STORAGE_KEYS.eventLog, JSON.stringify(bundle.eventLog));
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function clearStoredBundle(storage) {
  try {
    Object.values(REPO_STORAGE_KEYS).forEach((key) => removeCollection(storage, key));
    for (const key of storageKeys(storage)) {
      if (
        key.startsWith(LEGACY_KEYS.spellingPrefsPrefix)
        || key.startsWith(LEGACY_KEYS.spellingProgressPrefix)
        || key.startsWith(LEGACY_KEYS.monstersPrefix)
        || key === LEGACY_KEYS.appState
      ) {
        removeCollection(storage, key);
      }
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function createCollections(storage) {
  const bundle = hasNewRepositoryData(storage)
    ? normaliseRepositoryBundle({
      meta: loadCollection(storage, REPO_STORAGE_KEYS.meta, null),
      learners: loadCollection(storage, REPO_STORAGE_KEYS.learners, emptyLearnersSnapshot()),
      subjectStates: loadCollection(storage, REPO_STORAGE_KEYS.subjectStates, {}),
      practiceSessions: loadCollection(storage, REPO_STORAGE_KEYS.practiceSessions, []),
      gameState: loadCollection(storage, REPO_STORAGE_KEYS.gameState, {}),
      eventLog: loadCollection(storage, REPO_STORAGE_KEYS.eventLog, []),
    })
    : normaliseRepositoryBundle(loadLegacySeed(storage));

  bundle.meta = currentRepositoryMeta();
  const error = persistBundle(storage, bundle);
  return { bundle, error };
}

function localPersistenceSnapshot({ lastSyncAt, lastError = null, updatedAt = Date.now() } = {}) {
  if (lastError) {
    return {
      mode: PERSISTENCE_MODES.DEGRADED,
      remoteAvailable: false,
      trustedState: PERSISTENCE_TRUSTED_STATES.MEMORY,
      cacheState: PERSISTENCE_CACHE_STATES.MEMORY_ONLY,
      pendingWriteCount: 0,
      inFlightWriteCount: 0,
      lastSyncAt: Number(lastSyncAt) || 0,
      lastError,
      updatedAt: nowTs(updatedAt),
    };
  }

  return {
    ...defaultPersistenceSnapshot(PERSISTENCE_MODES.LOCAL_ONLY, updatedAt),
    trustedState: PERSISTENCE_TRUSTED_STATES.LOCAL,
    cacheState: PERSISTENCE_CACHE_STATES.LOCAL_ONLY,
    lastSyncAt: nowTs(updatedAt),
    lastError: null,
  };
}

export function createLocalPlatformRepositories({ storage } = {}) {
  const resolvedStorage = storage || globalThis.localStorage || createNoopStorage();
  const { bundle: collections, error: startupError } = createCollections(resolvedStorage);
  let lastSyncAt = startupError ? 0 : nowTs();
  const persistenceChannel = createPersistenceChannel(localPersistenceSnapshot({
    lastSyncAt,
    lastError: startupError
      ? createPersistenceError({
        phase: 'local-startup',
        scope: 'localStorage',
        message: startupError.message,
        retryable: true,
      })
      : null,
  }));

  function updateLocalPersistence(error = null, phase = 'local-write', scope = 'localStorage') {
    if (error) {
      return persistenceChannel.set(localPersistenceSnapshot({
        lastSyncAt,
        lastError: createPersistenceError({
          phase,
          scope,
          message: error.message || String(error),
          retryable: true,
        }),
      }));
    }

    lastSyncAt = nowTs();
    return persistenceChannel.set(localPersistenceSnapshot({ lastSyncAt }));
  }

  function persistAll(phase = 'local-write', scope = 'localStorage') {
    collections.meta = currentRepositoryMeta();
    const error = persistBundle(resolvedStorage, collections);
    if (error) {
      updateLocalPersistence(error, phase, scope);
      return false;
    }
    updateLocalPersistence(null, phase, scope);
    return true;
  }

  async function retryPersistence() {
    if (!persistAll('local-retry', 'localStorage')) {
      const snapshot = persistenceChannel.read();
      throw new Error(snapshot.lastError?.message || 'Local persistence retry failed.');
    }
    return persistenceChannel.read();
  }

  const repositories = {
    kind: 'local',
    persistence: {
      read() {
        return persistenceChannel.read();
      },
      subscribe(listener) {
        return persistenceChannel.subscribe(listener);
      },
      retry: retryPersistence,
    },
    async hydrate() {
      return undefined;
    },
    async flush() {
      if (!persistAll('local-flush', 'localStorage')) {
        const snapshot = persistenceChannel.read();
        throw new Error(snapshot.lastError?.message || 'Local persistence flush failed.');
      }
      return undefined;
    },
    clearAll() {
      collections.meta = currentRepositoryMeta();
      collections.learners = emptyLearnersSnapshot();
      collections.subjectStates = {};
      collections.practiceSessions = [];
      collections.gameState = {};
      collections.eventLog = [];
      const clearError = clearStoredBundle(resolvedStorage);
      if (clearError) {
        updateLocalPersistence(clearError, 'local-reset', 'localStorage');
      } else {
        lastSyncAt = nowTs();
        persistenceChannel.set(localPersistenceSnapshot({ lastSyncAt }));
      }
    },
    learners: {
      read() {
        return cloneSerialisable(collections.learners);
      },
      write(nextSnapshot) {
        collections.learners = normaliseLearnersSnapshot(nextSnapshot);
        persistAll('local-write', 'learners');
        return cloneSerialisable(collections.learners);
      },
      select(learnerId) {
        if (typeof learnerId !== 'string' || !collections.learners.byId[learnerId]) {
          return cloneSerialisable(collections.learners);
        }
        collections.learners = normaliseLearnersSnapshot({
          ...collections.learners,
          selectedId: learnerId,
        });
        persistAll('local-write', 'learners:selected');
        return cloneSerialisable(collections.learners);
      },
    },
    subjectStates: {
      read(learnerId, subjectId) {
        const key = subjectStateKey(learnerId, subjectId);
        return normaliseSubjectStateRecord(collections.subjectStates[key]);
      },
      readForLearner(learnerId) {
        const output = {};
        for (const [key, value] of Object.entries(collections.subjectStates)) {
          if (!key.startsWith(`${learnerId || 'default'}::`)) continue;
          const subjectId = key.split('::')[1];
          output[subjectId] = normaliseSubjectStateRecord(value);
        }
        return output;
      },
      writeUi(learnerId, subjectId, ui) {
        const key = subjectStateKey(learnerId, subjectId);
        const next = mergeSubjectUi(collections.subjectStates[key], ui, nowTs());
        collections.subjectStates[key] = next;
        persistAll('local-write', `subjectStates:${key}`);
        return normaliseSubjectStateRecord(next);
      },
      writeData(learnerId, subjectId, data) {
        const key = subjectStateKey(learnerId, subjectId);
        const next = mergeSubjectData(collections.subjectStates[key], data, nowTs());
        collections.subjectStates[key] = next;
        persistAll('local-write', `subjectStates:${key}`);
        return normaliseSubjectStateRecord(next);
      },
      writeRecord(learnerId, subjectId, record) {
        const key = subjectStateKey(learnerId, subjectId);
        const next = normaliseSubjectStateRecord(record);
        collections.subjectStates[key] = next;
        persistAll('local-write', `subjectStates:${key}`);
        return normaliseSubjectStateRecord(next);
      },
      clear(learnerId, subjectId) {
        delete collections.subjectStates[subjectStateKey(learnerId, subjectId)];
        persistAll('local-write', `subjectStates:${subjectStateKey(learnerId, subjectId)}`);
      },
      clearLearner(learnerId) {
        for (const key of Object.keys(collections.subjectStates)) {
          if (key.startsWith(`${learnerId || 'default'}::`)) delete collections.subjectStates[key];
        }
        persistAll('local-write', `subjectStates:${learnerId || 'default'}`);
      },
    },
    practiceSessions: {
      latest(learnerId, subjectId) {
        return cloneSerialisable(filterSessions(collections.practiceSessions, learnerId, subjectId)[0] || null);
      },
      list(learnerId = null, subjectId = null) {
        return cloneSerialisable(filterSessions(collections.practiceSessions, learnerId, subjectId));
      },
      write(record) {
        const next = normalisePracticeSessionRecord(record);
        if (!next.id || !next.learnerId || !next.subjectId) {
          throw new TypeError('Practice session records require id, learnerId and subjectId.');
        }
        const sessionKey = practiceSessionKey(next);
        const all = filterSessions(collections.practiceSessions);
        const existingIndex = all.findIndex((entry) => practiceSessionKey(entry) === sessionKey);
        if (existingIndex >= 0) all[existingIndex] = next;
        else all.push(next);
        collections.practiceSessions = all;
        persistAll('local-write', `practiceSessions:${sessionKey}`);
        return cloneSerialisable(next);
      },
      clear(learnerId, subjectId) {
        collections.practiceSessions = filterSessions(collections.practiceSessions)
          .filter((record) => !(record.learnerId === learnerId && record.subjectId === subjectId));
        persistAll('local-write', `practiceSessions:${learnerId || 'default'}:${subjectId || 'all'}`);
      },
      clearLearner(learnerId) {
        collections.practiceSessions = filterSessions(collections.practiceSessions)
          .filter((record) => record.learnerId !== learnerId);
        persistAll('local-write', `practiceSessions:${learnerId || 'default'}`);
      },
    },
    gameState: {
      read(learnerId, systemId) {
        return cloneSerialisable(collections.gameState[gameStateKey(learnerId, systemId)] || {});
      },
      readForLearner(learnerId) {
        const output = {};
        for (const [key, value] of Object.entries(collections.gameState)) {
          if (!key.startsWith(`${learnerId || 'default'}::`)) continue;
          const parsed = parseGameStateKey(key);
          if (!parsed) continue;
          output[parsed.systemId] = cloneSerialisable(value) || {};
        }
        return output;
      },
      write(learnerId, systemId, state) {
        collections.gameState[gameStateKey(learnerId, systemId)] = cloneSerialisable(state) || {};
        persistAll('local-write', `gameState:${gameStateKey(learnerId, systemId)}`);
        return this.read(learnerId, systemId);
      },
      clear(learnerId, systemId) {
        delete collections.gameState[gameStateKey(learnerId, systemId)];
        persistAll('local-write', `gameState:${gameStateKey(learnerId, systemId)}`);
      },
      clearLearner(learnerId) {
        for (const key of Object.keys(collections.gameState)) {
          if (key.startsWith(`${learnerId || 'default'}::`)) delete collections.gameState[key];
        }
        persistAll('local-write', `gameState:${learnerId || 'default'}`);
      },
    },
    eventLog: {
      append(event) {
        const next = cloneSerialisable(event) || null;
        if (!next || typeof next !== 'object' || Array.isArray(next)) return null;
        collections.eventLog = [...collections.eventLog, next].slice(-1000);
        persistAll('local-write', 'eventLog');
        return cloneSerialisable(next);
      },
      list(learnerId = null) {
        const events = Array.isArray(collections.eventLog) ? collections.eventLog : [];
        return cloneSerialisable(
          learnerId
            ? events.filter((event) => event?.learnerId === learnerId)
            : events,
        );
      },
      clearLearner(learnerId) {
        collections.eventLog = (Array.isArray(collections.eventLog) ? collections.eventLog : [])
          .filter((event) => event?.learnerId !== learnerId);
        persistAll('local-write', `eventLog:${learnerId || 'default'}`);
      },
    },
  };

  return validatePlatformRepositories(repositories);
}
