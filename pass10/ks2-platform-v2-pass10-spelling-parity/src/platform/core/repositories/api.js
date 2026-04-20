import { uid } from '../utils.js';
import {
  cloneSerialisable,
  currentRepositoryMeta,
  emptyLearnersSnapshot,
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
import {
  applyRepositoryAuthSession,
  createNoopRepositoryAuthSession,
  repositoryAuthCacheScopeKey,
} from './auth-session.js';

const MUTATION_POLICY_VERSION = 1;
const OPERATION_STATUS_PENDING = 'pending';
const OPERATION_STATUS_BLOCKED_STALE = 'blocked-stale';

function apiCacheStorageKey(scope = 'default') {
  return `ks2-platform-v2.api-cache-state:${scope}`;
}

function createNoopStorage() {
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    key() { return null; },
    get length() { return 0; },
  };
}

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

class RepositoryHttpError extends Error {
  constructor({ url, method, status = 0, payload = null, text = '', correlationId = null }) {
    const message = payload?.message
      || (typeof text === 'string' && text.trim())
      || `Repository sync failed (${status}).`;
    super(`Repository sync failed (${status}): ${message}`);
    this.name = 'RepositoryHttpError';
    this.url = url;
    this.method = method;
    this.status = Number(status) || 0;
    this.payload = payload;
    this.text = text;
    this.code = payload?.code || null;
    this.retryable = status >= 500 || status === 0;
    this.correlationId = correlationId || payload?.correlationId || payload?.requestId || null;
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return {
      payload: await response.json().catch(() => null),
      text: '',
    };
  }
  const text = await response.text().catch(() => '');
  return {
    payload: null,
    text,
  };
}

async function fetchJson(fetchFn, url, init, authSession) {
  const resolvedInit = await applyRepositoryAuthSession(authSession, init);
  const method = String(resolvedInit?.method || 'GET').toUpperCase();
  let response;
  try {
    response = await fetchFn(url, resolvedInit);
  } catch (error) {
    const wrapped = new RepositoryHttpError({
      url,
      method,
      status: 0,
      payload: null,
      text: error?.message || String(error),
    });
    wrapped.cause = error;
    throw wrapped;
  }

  const { payload, text } = await parseResponseBody(response);
  if (!response.ok) {
    throw new RepositoryHttpError({
      url,
      method,
      status: response.status,
      payload,
      text,
      correlationId: payload?.mutation?.correlationId || payload?.correlationId || payload?.requestId || null,
    });
  }

  return response.status === 204 ? null : (payload ?? null);
}

function emptyApiBundle() {
  return normaliseRepositoryBundle({
    meta: currentRepositoryMeta(),
    learners: emptyLearnersSnapshot(),
    subjectStates: {},
    practiceSessions: [],
    gameState: {},
    eventLog: [],
  });
}

function emptySyncState() {
  return {
    policyVersion: MUTATION_POLICY_VERSION,
    accountRevision: 0,
    learnerRevisions: {},
  };
}

function normaliseSyncState(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
  const learnerRevisionsRaw = raw.learnerRevisions && typeof raw.learnerRevisions === 'object' && !Array.isArray(raw.learnerRevisions)
    ? raw.learnerRevisions
    : {};
  const learnerRevisions = Object.fromEntries(Object.entries(learnerRevisionsRaw)
    .filter(([key]) => typeof key === 'string' && key)
    .map(([key, value]) => [key, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)]));

  return {
    policyVersion: Math.max(1, Number.isFinite(Number(raw.policyVersion)) ? Number(raw.policyVersion) : MUTATION_POLICY_VERSION),
    accountRevision: Math.max(0, Number.isFinite(Number(raw.accountRevision)) ? Number(raw.accountRevision) : 0),
    learnerRevisions,
  };
}

function logSync(level, event, details = {}) {
  const payload = {
    event,
    ...cloneSerialisable(details),
    at: new Date().toISOString(),
  };
  const fn = globalThis.console?.[level] || globalThis.console?.log;
  if (!fn) return;
  try {
    fn('[ks2-sync]', JSON.stringify(payload));
  } catch {
    fn('[ks2-sync]', payload);
  }
}

function eventToken(event) {
  if (typeof event?.id === 'string' && event.id) return event.id;
  if (typeof event?.type === 'string') {
    return [
      event.type,
      event.learnerId || '',
      event.sessionId || '',
      event.wordSlug || '',
      event.monsterId || '',
      event.createdAt || '',
    ].join(':');
  }
  if (typeof event?.kind === 'string') {
    return [
      'reward',
      event.kind,
      event.learnerId || '',
      event.monsterId || '',
      event.createdAt || '',
    ].join(':');
  }
  return null;
}

function operationKey(kind, payload = {}) {
  if (kind === 'learners.write') return 'learners';
  if (kind === 'subjectStates.put' || kind === 'subjectStates.delete') {
    return `subjectState:${subjectStateKey(payload.learnerId, payload.subjectId)}`;
  }
  if (kind === 'subjectStates.clearLearner') return `subjectStateLearner:${payload.learnerId || 'default'}`;
  if (kind === 'practiceSessions.put') return `practiceSession:${practiceSessionKey(payload.record)}`;
  if (kind === 'practiceSessions.delete') return `practiceSessionClear:${payload.learnerId || 'default'}:${payload.subjectId || 'all'}`;
  if (kind === 'practiceSessions.clearLearner') return `practiceSessionLearner:${payload.learnerId || 'default'}`;
  if (kind === 'gameState.put' || kind === 'gameState.delete') {
    return `gameState:${gameStateKey(payload.learnerId, payload.systemId)}`;
  }
  if (kind === 'gameState.clearLearner') return `gameStateLearner:${payload.learnerId || 'default'}`;
  if (kind === 'eventLog.append') return `event:${eventToken(payload.event) || payload.id || uid('event')}`;
  if (kind === 'eventLog.clearLearner') return `eventLogLearner:${payload.learnerId || 'default'}`;
  if (kind === 'debug.reset') return 'debug/reset';
  return `${kind}:${payload.id || uid('op')}`;
}

function operationScope(raw) {
  if (raw.kind === 'learners.write' || raw.kind === 'debug.reset') {
    return { scopeType: 'account', scopeId: 'account' };
  }
  const learnerId = raw.record?.learnerId || raw.learnerId || raw.event?.learnerId || 'default';
  return { scopeType: 'learner', scopeId: learnerId };
}

function normalisePendingOperation(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : null;
  if (!raw || typeof raw.kind !== 'string' || !raw.kind) return null;
  const createdAt = nowTs(raw.createdAt);
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid('sync');
  const status = raw.status === OPERATION_STATUS_BLOCKED_STALE ? OPERATION_STATUS_BLOCKED_STALE : OPERATION_STATUS_PENDING;
  const scope = operationScope(raw);
  const expectedRevision = Math.max(0, Number.isFinite(Number(raw.expectedRevision)) ? Number(raw.expectedRevision) : 0);
  const correlationId = typeof raw.correlationId === 'string' && raw.correlationId ? raw.correlationId : id;

  switch (raw.kind) {
    case 'learners.write':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        snapshot: normaliseLearnersSnapshot(raw.snapshot),
      };
    case 'subjectStates.put':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
        subjectId: raw.subjectId || 'unknown',
        record: normaliseSubjectStateRecord(raw.record),
      };
    case 'subjectStates.delete':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
        subjectId: raw.subjectId || 'unknown',
      };
    case 'subjectStates.clearLearner':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
      };
    case 'practiceSessions.put': {
      const record = normalisePracticeSessionRecord(raw.record);
      if (!record.id || !record.learnerId || !record.subjectId) return null;
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, { record }),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        record,
      };
    }
    case 'practiceSessions.delete':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
        subjectId: raw.subjectId || null,
      };
    case 'practiceSessions.clearLearner':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
      };
    case 'gameState.put':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
        systemId: raw.systemId || 'unknown',
        state: cloneSerialisable(raw.state) || {},
      };
    case 'gameState.delete':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
        systemId: raw.systemId || 'unknown',
      };
    case 'gameState.clearLearner':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
      };
    case 'eventLog.append': {
      const event = cloneSerialisable(raw.event) || null;
      if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, { event, id }),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        event,
      };
    }
    case 'eventLog.clearLearner':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
        learnerId: raw.learnerId || 'default',
      };
    case 'debug.reset':
      return {
        id,
        kind: raw.kind,
        key: operationKey(raw.kind, raw),
        createdAt,
        status,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        expectedRevision,
        correlationId,
      };
    default:
      return null;
  }
}

function normalisePendingOperations(rawValue) {
  const input = Array.isArray(rawValue) ? rawValue : [];
  return input.map(normalisePendingOperation).filter(Boolean);
}

function loadCachedState(storage, storageKey) {
  const raw = loadCollection(storage, storageKey, null);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      bundle: normaliseRepositoryBundle(raw.bundle || raw),
      pendingOperations: normalisePendingOperations(raw.pendingOperations),
      syncState: normaliseSyncState(raw.syncState),
    };
  }
  return {
    bundle: emptyApiBundle(),
    pendingOperations: [],
    syncState: emptySyncState(),
  };
}

function persistCachedState(storage, storageKey, bundle, pendingOperations, syncState) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({
      bundle,
      pendingOperations,
      syncState,
    }));
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function upsertPracticeSession(records, record) {
  const next = normalisePracticeSessionRecord(record);
  if (!next.id || !next.learnerId || !next.subjectId) return filterSessions(records);
  const key = practiceSessionKey(next);
  const output = filterSessions(records);
  const index = output.findIndex((entry) => practiceSessionKey(entry) === key);
  if (index >= 0) output[index] = next;
  else output.push(next);
  return output;
}

function dedupeEventLog(events) {
  const seen = new Set();
  const output = [];
  for (const event of Array.isArray(events) ? events : []) {
    const next = cloneSerialisable(event) || null;
    if (!next || typeof next !== 'object' || Array.isArray(next)) continue;
    const token = eventToken(next);
    if (token && seen.has(token)) continue;
    if (token) seen.add(token);
    output.push(next);
  }
  return output.slice(-1000);
}

function applyOperationToBundle(bundle, operation) {
  switch (operation.kind) {
    case 'learners.write':
      bundle.learners = normaliseLearnersSnapshot(operation.snapshot);
      return bundle;
    case 'subjectStates.put':
      bundle.subjectStates[subjectStateKey(operation.learnerId, operation.subjectId)] = normaliseSubjectStateRecord(operation.record);
      return bundle;
    case 'subjectStates.delete':
      delete bundle.subjectStates[subjectStateKey(operation.learnerId, operation.subjectId)];
      return bundle;
    case 'subjectStates.clearLearner':
      for (const key of Object.keys(bundle.subjectStates)) {
        if (key.startsWith(`${operation.learnerId || 'default'}::`)) delete bundle.subjectStates[key];
      }
      return bundle;
    case 'practiceSessions.put':
      bundle.practiceSessions = upsertPracticeSession(bundle.practiceSessions, operation.record);
      return bundle;
    case 'practiceSessions.delete':
      bundle.practiceSessions = filterSessions(bundle.practiceSessions)
        .filter((record) => !(record.learnerId === operation.learnerId && record.subjectId === operation.subjectId));
      return bundle;
    case 'practiceSessions.clearLearner':
      bundle.practiceSessions = filterSessions(bundle.practiceSessions)
        .filter((record) => record.learnerId !== operation.learnerId);
      return bundle;
    case 'gameState.put':
      bundle.gameState[gameStateKey(operation.learnerId, operation.systemId)] = cloneSerialisable(operation.state) || {};
      return bundle;
    case 'gameState.delete':
      delete bundle.gameState[gameStateKey(operation.learnerId, operation.systemId)];
      return bundle;
    case 'gameState.clearLearner':
      for (const key of Object.keys(bundle.gameState)) {
        if (key.startsWith(`${operation.learnerId || 'default'}::`)) delete bundle.gameState[key];
      }
      return bundle;
    case 'eventLog.append':
      bundle.eventLog = dedupeEventLog([...(Array.isArray(bundle.eventLog) ? bundle.eventLog : []), operation.event]);
      return bundle;
    case 'eventLog.clearLearner':
      bundle.eventLog = dedupeEventLog((Array.isArray(bundle.eventLog) ? bundle.eventLog : [])
        .filter((event) => event?.learnerId !== operation.learnerId));
      return bundle;
    case 'debug.reset':
      bundle.meta = currentRepositoryMeta();
      bundle.learners = emptyLearnersSnapshot();
      bundle.subjectStates = {};
      bundle.practiceSessions = [];
      bundle.gameState = {};
      bundle.eventLog = [];
      return bundle;
    default:
      return bundle;
  }
}

function cloneSyncState(syncState) {
  return normaliseSyncState(cloneSerialisable(syncState));
}

function setScopeRevision(syncState, scopeType, scopeId, appliedRevision) {
  const next = cloneSyncState(syncState);
  const revision = Math.max(0, Number.isFinite(Number(appliedRevision)) ? Number(appliedRevision) : 0);
  if (scopeType === 'account') {
    next.accountRevision = revision;
    return next;
  }
  const learnerId = scopeId || 'default';
  next.learnerRevisions[learnerId] = revision;
  return next;
}

function syncStateFromMutationResponse(syncState, operation, payload) {
  const remoteSyncState = payload && typeof payload === 'object' && !Array.isArray(payload) && payload.syncState
    ? normaliseSyncState(payload.syncState)
    : null;
  if (remoteSyncState) return remoteSyncState;

  const mutation = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload.mutation
    : null;
  const appliedRevision = Number(mutation?.appliedRevision);
  if (!Number.isFinite(appliedRevision)) return cloneSyncState(syncState);
  return setScopeRevision(syncState, operation.scopeType, operation.scopeId, appliedRevision);
}

function advanceSyncState(syncState, operation) {
  const next = cloneSyncState(syncState);
  if (operation.scopeType === 'account') {
    next.accountRevision += 1;
    if (operation.kind === 'debug.reset') next.learnerRevisions = {};
    return next;
  }
  const learnerId = operation.scopeId || operation.learnerId || 'default';
  next.learnerRevisions[learnerId] = Math.max(0, Number(next.learnerRevisions[learnerId]) || 0) + 1;
  return next;
}

function applyPendingOperations(bundle, operations) {
  const next = normaliseRepositoryBundle(cloneSerialisable(bundle));
  for (const operation of normalisePendingOperations(operations)) {
    if (operation.status !== OPERATION_STATUS_PENDING) continue;
    applyOperationToBundle(next, operation);
  }
  return next;
}

function replaySyncState(baseSyncState, operations) {
  let next = cloneSyncState(baseSyncState);
  for (const operation of normalisePendingOperations(operations)) {
    if (operation.status !== OPERATION_STATUS_PENDING) continue;
    next = advanceSyncState(next, operation);
  }
  return next;
}

function createOperation(kind, payload = {}, syncState = emptySyncState(), now = Date.now) {
  const scope = operationScope({ kind, ...payload });
  const currentSyncState = cloneSyncState(syncState);
  const expectedRevision = scope.scopeType === 'account'
    ? currentSyncState.accountRevision
    : Math.max(0, Number(currentSyncState.learnerRevisions[scope.scopeId]) || 0);
  const operation = normalisePendingOperation({
    id: uid('sync'),
    kind,
    createdAt: nowTs(now),
    status: OPERATION_STATUS_PENDING,
    expectedRevision,
    correlationId: uid('corr'),
    ...payload,
  });
  if (!operation) throw new TypeError(`Could not create pending operation for ${kind}.`);
  return operation;
}

function classifyError(error, fallbackScope = 'remote-sync') {
  if (error instanceof RepositoryHttpError) {
    const retryable = error.status >= 500 || error.status === 0;
    return createPersistenceError({
      phase: error.status === 409 ? 'remote-conflict' : 'remote-write',
      scope: fallbackScope,
      code: error.code || (error.status === 409 ? 'conflict' : 'remote_error'),
      message: error.payload?.message || error.text || error.message,
      retryable,
      correlationId: error.correlationId,
      resolution: error.status === 409 ? 'retry-sync-reloads-latest' : 'retry-sync',
      details: {
        status: error.status,
        payload: error.payload && typeof error.payload === 'object' ? error.payload : null,
        url: error.url,
        method: error.method,
      },
    });
  }

  return createPersistenceError({
    phase: 'remote-write',
    scope: fallbackScope,
    code: 'network_error',
    message: error?.message || String(error),
    retryable: true,
    resolution: 'retry-sync',
  });
}

function countPending(operations) {
  return normalisePendingOperations(operations).length;
}

function hasBlockedOperations(operations) {
  return normalisePendingOperations(operations).some((operation) => operation.status === OPERATION_STATUS_BLOCKED_STALE);
}

function firstQueueOperation(operations) {
  return normalisePendingOperations(operations)[0] || null;
}

function blockOperationsForConflict(operations, failedOperation) {
  let seenFailed = false;
  return normalisePendingOperations(operations).map((operation) => {
    if (!seenFailed) {
      if (operation.id === failedOperation.id) {
        seenFailed = true;
        return { ...operation, status: OPERATION_STATUS_BLOCKED_STALE };
      }
      return operation;
    }

    if (failedOperation.scopeType === 'account') {
      return { ...operation, status: OPERATION_STATUS_BLOCKED_STALE };
    }

    if (operation.scopeType === 'learner' && operation.scopeId === failedOperation.scopeId) {
      return { ...operation, status: OPERATION_STATUS_BLOCKED_STALE };
    }

    return operation;
  });
}

export function createApiPlatformRepositories({
  baseUrl = '',
  fetch: fetchFn = globalThis.fetch,
  storage,
  authSession = createNoopRepositoryAuthSession(),
  cacheScopeKey = null,
} = {}) {
  if (typeof fetchFn !== 'function') {
    throw new TypeError('API repositories require a fetch implementation.');
  }

  const resolvedStorage = storage || globalThis.localStorage || createNoopStorage();
  const resolvedCacheScopeKey = typeof cacheScopeKey === 'string' && cacheScopeKey
    ? cacheScopeKey
    : repositoryAuthCacheScopeKey(authSession);
  const storageKey = apiCacheStorageKey(resolvedCacheScopeKey);
  const cachedState = loadCachedState(resolvedStorage, storageKey);
  const cache = normaliseRepositoryBundle(cachedState.bundle);
  let pendingOperations = normalisePendingOperations(cachedState.pendingOperations);
  let syncState = normaliseSyncState(cachedState.syncState);
  let inFlightWriteCount = 0;
  let lastSyncAt = 0;
  let lastRemoteError = null;
  let lastCacheError = null;
  let processingLoop = Promise.resolve();
  let processing = false;

  const persistenceChannel = createPersistenceChannel({
    ...defaultPersistenceSnapshot(PERSISTENCE_MODES.REMOTE_SYNC),
    pendingWriteCount: countPending(pendingOperations),
    cacheState: countPending(pendingOperations) ? PERSISTENCE_CACHE_STATES.AHEAD_OF_REMOTE : PERSISTENCE_CACHE_STATES.ALIGNED,
    trustedState: countPending(pendingOperations) ? PERSISTENCE_TRUSTED_STATES.LOCAL_CACHE : PERSISTENCE_TRUSTED_STATES.REMOTE,
  });

  function persistLocalCache(scope = 'api-cache') {
    cache.meta = currentRepositoryMeta();
    const error = persistCachedState(resolvedStorage, storageKey, cache, pendingOperations, syncState);
    if (error) {
      lastCacheError = createPersistenceError({
        phase: 'cache-write',
        scope,
        code: 'cache_write_failed',
        message: error.message || String(error),
        retryable: true,
        resolution: 'retry-sync',
      });
    } else {
      lastCacheError = null;
    }
    recomputePersistence();
    return !error;
  }

  function currentLastError() {
    if (lastRemoteError) return lastRemoteError;
    if (lastCacheError) return lastCacheError;
    if (countPending(pendingOperations) > 0) {
      const blocked = hasBlockedOperations(pendingOperations);
      return createPersistenceError({
        phase: blocked ? 'remote-conflict' : 'pending-sync',
        scope: 'remote-cache',
        code: blocked ? 'stale_write' : 'pending_sync',
        message: blocked
          ? 'A newer remote change blocked one or more local writes. Retry sync to reload the latest remote state and discard the blocked local change.'
          : `${countPending(pendingOperations)} cached change${countPending(pendingOperations) === 1 ? '' : 's'} still need remote sync.`,
        retryable: !blocked,
        resolution: blocked ? 'retry-sync-reloads-latest' : 'retry-sync',
      });
    }
    return null;
  }

  function recomputePersistence() {
    const pendingWriteCount = countPending(pendingOperations);
    const lastError = currentLastError();
    const blocked = hasBlockedOperations(pendingOperations);

    if (lastError || pendingWriteCount > 0) {
      const trustedState = lastCacheError
        ? PERSISTENCE_TRUSTED_STATES.MEMORY
        : (blocked ? PERSISTENCE_TRUSTED_STATES.LOCAL_CACHE : PERSISTENCE_TRUSTED_STATES.LOCAL_CACHE);
      const cacheState = lastCacheError
        ? PERSISTENCE_CACHE_STATES.MEMORY_ONLY
        : (pendingWriteCount > 0 ? PERSISTENCE_CACHE_STATES.AHEAD_OF_REMOTE : PERSISTENCE_CACHE_STATES.STALE_COPY);
      return persistenceChannel.set({
        mode: PERSISTENCE_MODES.DEGRADED,
        remoteAvailable: true,
        trustedState,
        cacheState,
        pendingWriteCount,
        inFlightWriteCount,
        lastSyncAt,
        lastError,
        updatedAt: nowTs(),
      });
    }

    return persistenceChannel.set({
      mode: PERSISTENCE_MODES.REMOTE_SYNC,
      remoteAvailable: true,
      trustedState: PERSISTENCE_TRUSTED_STATES.REMOTE,
      cacheState: PERSISTENCE_CACHE_STATES.ALIGNED,
      pendingWriteCount: 0,
      inFlightWriteCount,
      lastSyncAt,
      lastError: null,
      updatedAt: nowTs(),
    });
  }

  function markRemoteSuccess() {
    lastRemoteError = null;
    lastSyncAt = nowTs();
    recomputePersistence();
  }

  function markRemoteFailure(error) {
    lastRemoteError = error;
    recomputePersistence();
  }

  function removeOperationById(id) {
    const next = pendingOperations.filter((operation) => operation.id !== id);
    const removed = next.length !== pendingOperations.length;
    if (removed) pendingOperations = next;
    return removed;
  }

  function dropBlockedOperations() {
    const blocked = pendingOperations.filter((operation) => operation.status === OPERATION_STATUS_BLOCKED_STALE);
    if (!blocked.length) return 0;
    pendingOperations = pendingOperations.filter((operation) => operation.status !== OPERATION_STATUS_BLOCKED_STALE);
    logSync('warn', 'sync.conflicts_discarded', {
      discardedCount: blocked.length,
      scopes: [...new Set(blocked.map((operation) => `${operation.scopeType}:${operation.scopeId}`))],
    });
    return blocked.length;
  }

  function applyHydratedState(remoteBundle, remoteSyncState) {
    const effectiveBundle = applyPendingOperations(remoteBundle, pendingOperations);
    cache.meta = currentRepositoryMeta();
    cache.learners = effectiveBundle.learners;
    cache.subjectStates = effectiveBundle.subjectStates;
    cache.practiceSessions = effectiveBundle.practiceSessions;
    cache.gameState = effectiveBundle.gameState;
    cache.eventLog = effectiveBundle.eventLog;
    syncState = replaySyncState(remoteSyncState, pendingOperations);
  }

  function queueOperation(operation) {
    pendingOperations = [...pendingOperations, operation];
    applyOperationToBundle(cache, operation);
    syncState = advanceSyncState(syncState, operation);
    persistLocalCache(operation.key || operation.kind);
    recomputePersistence();
    logSync('info', 'sync.operation_queued', {
      id: operation.id,
      kind: operation.kind,
      scopeType: operation.scopeType,
      scopeId: operation.scopeId,
      expectedRevision: operation.expectedRevision,
      pendingWriteCount: countPending(pendingOperations),
    });
  }

  async function sendRemoteOperation(operation) {
    const mutation = operation.scopeType === 'account'
      ? {
        requestId: operation.id,
        correlationId: operation.correlationId,
        expectedAccountRevision: operation.expectedRevision,
      }
      : {
        requestId: operation.id,
        correlationId: operation.correlationId,
        expectedLearnerRevision: operation.expectedRevision,
      };
    const headers = {
      'content-type': 'application/json',
      'x-ks2-request-id': operation.id,
      'x-ks2-correlation-id': operation.correlationId,
    };

    switch (operation.kind) {
      case 'learners.write':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/learners'), {
          method: 'PUT',
          headers,
          body: JSON.stringify({ learners: cloneSerialisable(operation.snapshot), mutation }),
        }, authSession);
      case 'subjectStates.put':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-subject-state'), {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            learnerId: operation.learnerId,
            subjectId: operation.subjectId,
            record: cloneSerialisable(operation.record),
            mutation,
          }),
        }, authSession);
      case 'subjectStates.delete':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-subject-state'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, subjectId: operation.subjectId, mutation }),
        }, authSession);
      case 'subjectStates.clearLearner':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-subject-state'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, mutation }),
        }, authSession);
      case 'practiceSessions.put':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/practice-sessions'), {
          method: 'PUT',
          headers,
          body: JSON.stringify({ record: cloneSerialisable(operation.record), mutation }),
        }, authSession);
      case 'practiceSessions.delete':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/practice-sessions'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, subjectId: operation.subjectId, mutation }),
        }, authSession);
      case 'practiceSessions.clearLearner':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/practice-sessions'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, mutation }),
        }, authSession);
      case 'gameState.put':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-game-state'), {
          method: 'PUT',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, systemId: operation.systemId, state: cloneSerialisable(operation.state), mutation }),
        }, authSession);
      case 'gameState.delete':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-game-state'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, systemId: operation.systemId, mutation }),
        }, authSession);
      case 'gameState.clearLearner':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/child-game-state'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, mutation }),
        }, authSession);
      case 'eventLog.append':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/event-log'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ event: cloneSerialisable(operation.event), mutation }),
        }, authSession);
      case 'eventLog.clearLearner':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/event-log'), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ learnerId: operation.learnerId, mutation }),
        }, authSession);
      case 'debug.reset':
        return fetchJson(fetchFn, joinUrl(baseUrl, '/api/debug/reset'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ reset: true, mutation }),
        }, authSession);
      default:
        return null;
    }
  }

  async function syncOperation(operation) {
    const payload = await sendRemoteOperation(operation);
    removeOperationById(operation.id);
    syncState = syncStateFromMutationResponse(syncState, operation, payload);
    markRemoteSuccess();
    persistLocalCache(operation.key || operation.kind);
    logSync('info', 'sync.operation_applied', {
      id: operation.id,
      kind: operation.kind,
      scopeType: operation.scopeType,
      scopeId: operation.scopeId,
      replayed: Boolean(payload?.mutation?.replayed),
      appliedRevision: payload?.mutation?.appliedRevision ?? null,
      pendingWriteCount: countPending(pendingOperations),
    });
  }

  function handleConflict(operation, error) {
    pendingOperations = blockOperationsForConflict(pendingOperations, operation);
    lastRemoteError = classifyError(error, operation.key || operation.kind);
    persistLocalCache(operation.key || operation.kind);
    logSync('warn', 'sync.operation_blocked', {
      id: operation.id,
      kind: operation.kind,
      scopeType: operation.scopeType,
      scopeId: operation.scopeId,
      expectedRevision: operation.expectedRevision,
      error: lastRemoteError,
    });
    recomputePersistence();
  }

  function handleTransportFailure(operation, error) {
    lastRemoteError = classifyError(error, operation.key || operation.kind);
    persistLocalCache(operation.key || operation.kind);
    logSync('warn', 'sync.operation_failed', {
      id: operation.id,
      kind: operation.kind,
      scopeType: operation.scopeType,
      scopeId: operation.scopeId,
      expectedRevision: operation.expectedRevision,
      error: lastRemoteError,
    });
    recomputePersistence();
  }

  async function processPendingQueue() {
    if (processing) {
      await processingLoop;
      return;
    }

    processing = true;
    processingLoop = (async () => {
      while (true) {
        const nextOperation = firstQueueOperation(pendingOperations);
        if (!nextOperation) break;
        if (nextOperation.status === OPERATION_STATUS_BLOCKED_STALE) break;

        inFlightWriteCount += 1;
        recomputePersistence();
        try {
          await syncOperation(nextOperation);
        } catch (error) {
          if (error instanceof RepositoryHttpError && error.status === 409) {
            handleConflict(nextOperation, error);
          } else {
            handleTransportFailure(nextOperation, error);
          }
          break;
        } finally {
          inFlightWriteCount = Math.max(0, inFlightWriteCount - 1);
          recomputePersistence();
        }
      }
    })().finally(() => {
      processing = false;
    });

    return processingLoop;
  }

  function kickQueue() {
    processPendingQueue().catch((error) => {
      logSync('warn', 'sync.queue_unhandled', { message: error?.message || String(error) });
    });
  }

  recomputePersistence();

  const repositories = {
    kind: 'api',
    persistence: {
      read() {
        return persistenceChannel.read();
      },
      subscribe(listener) {
        return persistenceChannel.subscribe(listener);
      },
      async retry() {
        const discardedCount = dropBlockedOperations();
        await repositories.hydrate();
        if (discardedCount) persistLocalCache('discard-blocked');
        await repositories.flush();
        const snapshot = persistenceChannel.read();
        if (snapshot.mode === PERSISTENCE_MODES.DEGRADED) {
          throw new Error(snapshot.lastError?.message || 'Remote sync is still degraded.');
        }
        return snapshot;
      },
    },
    async hydrate() {
      try {
        const payload = await fetchJson(fetchFn, joinUrl(baseUrl, '/api/bootstrap'), {
          method: 'GET',
          headers: { accept: 'application/json' },
        }, authSession);
        const remoteBundle = normaliseRepositoryBundle(payload);
        const remoteSyncState = normaliseSyncState(payload?.syncState);
        applyHydratedState(remoteBundle, remoteSyncState);
        markRemoteSuccess();
        persistLocalCache('bootstrap');
        return undefined;
      } catch (error) {
        const persistenceError = classifyError(error, '/api/bootstrap');
        markRemoteFailure(persistenceError);
        const hasCacheFallback = Boolean(
          cache.learners.allIds.length
          || Object.keys(cache.subjectStates).length
          || filterSessions(cache.practiceSessions).length
          || Object.keys(cache.gameState).length
          || (Array.isArray(cache.eventLog) && cache.eventLog.length)
          || countPending(pendingOperations),
        );
        if (hasCacheFallback) return undefined;
        throw error;
      }
    },
    async flush() {
      await processPendingQueue();
      const snapshot = persistenceChannel.read();
      if (snapshot.mode === PERSISTENCE_MODES.DEGRADED) {
        throw new Error(snapshot.lastError?.message || 'Remote sync is still degraded.');
      }
      return undefined;
    },
    clearAll() {
      const operation = createOperation('debug.reset', {}, syncState);
      queueOperation(operation);
      kickQueue();
    },
    learners: {
      read() {
        return cloneSerialisable(cache.learners);
      },
      write(nextSnapshot) {
        const operation = createOperation('learners.write', {
          snapshot: normaliseLearnersSnapshot(nextSnapshot),
        }, syncState);
        queueOperation(operation);
        kickQueue();
        return cloneSerialisable(cache.learners);
      },
    },
    subjectStates: {
      read(learnerId, subjectId) {
        return normaliseSubjectStateRecord(cache.subjectStates[subjectStateKey(learnerId, subjectId)]);
      },
      readForLearner(learnerId) {
        const output = {};
        for (const [key, value] of Object.entries(cache.subjectStates)) {
          if (!key.startsWith(`${learnerId || 'default'}::`)) continue;
          const resolvedSubjectId = key.split('::')[1];
          output[resolvedSubjectId] = normaliseSubjectStateRecord(value);
        }
        return output;
      },
      writeUi(learnerId, subjectId, ui) {
        return this.writeRecord(learnerId, subjectId, mergeSubjectUi(this.read(learnerId, subjectId), ui, nowTs()));
      },
      writeData(learnerId, subjectId, data) {
        return this.writeRecord(learnerId, subjectId, mergeSubjectData(this.read(learnerId, subjectId), data, nowTs()));
      },
      writeRecord(learnerId, subjectId, record) {
        const operation = createOperation('subjectStates.put', {
          learnerId,
          subjectId,
          record: normaliseSubjectStateRecord(record),
        }, syncState);
        queueOperation(operation);
        kickQueue();
        return normaliseSubjectStateRecord(cache.subjectStates[subjectStateKey(learnerId, subjectId)]);
      },
      clear(learnerId, subjectId) {
        const operation = createOperation('subjectStates.delete', { learnerId, subjectId }, syncState);
        queueOperation(operation);
        kickQueue();
      },
      clearLearner(learnerId) {
        const operation = createOperation('subjectStates.clearLearner', { learnerId }, syncState);
        queueOperation(operation);
        kickQueue();
      },
    },
    practiceSessions: {
      latest(learnerId, subjectId) {
        const records = filterSessions(cache.practiceSessions);
        return records.find((record) => record.learnerId === learnerId && record.subjectId === subjectId) || null;
      },
      list(learnerId = null, subjectId = null) {
        return filterSessions(cache.practiceSessions).filter((record) => {
          if (learnerId && record.learnerId !== learnerId) return false;
          if (subjectId && record.subjectId !== subjectId) return false;
          return true;
        });
      },
      write(record) {
        const operation = createOperation('practiceSessions.put', {
          record: normalisePracticeSessionRecord(record),
        }, syncState);
        queueOperation(operation);
        kickQueue();
        return this.latest(operation.record.learnerId, operation.record.subjectId);
      },
      clear(learnerId, subjectId = null) {
        const operation = createOperation(subjectId ? 'practiceSessions.delete' : 'practiceSessions.clearLearner', {
          learnerId,
          subjectId,
        }, syncState);
        queueOperation(operation);
        kickQueue();
      },
      clearLearner(learnerId) {
        const operation = createOperation('practiceSessions.clearLearner', { learnerId }, syncState);
        queueOperation(operation);
        kickQueue();
      },
    },
    gameState: {
      read(learnerId, systemId) {
        const key = gameStateKey(learnerId, systemId);
        return cloneSerialisable(cache.gameState[key] || {});
      },
      readForLearner(learnerId) {
        const output = {};
        for (const [key, value] of Object.entries(cache.gameState)) {
          const parsed = parseGameStateKey(key);
          if (!parsed || parsed.learnerId !== learnerId) continue;
          output[parsed.systemId] = cloneSerialisable(value) || {};
        }
        return output;
      },
      write(learnerId, systemId, state) {
        const operation = createOperation('gameState.put', {
          learnerId,
          systemId,
          state,
        }, syncState);
        queueOperation(operation);
        kickQueue();
        return this.read(learnerId, systemId);
      },
      clear(learnerId, systemId = null) {
        const operation = createOperation(systemId ? 'gameState.delete' : 'gameState.clearLearner', {
          learnerId,
          systemId,
        }, syncState);
        queueOperation(operation);
        kickQueue();
      },
      clearLearner(learnerId) {
        const operation = createOperation('gameState.clearLearner', { learnerId }, syncState);
        queueOperation(operation);
        kickQueue();
      },
    },
    eventLog: {
      append(event) {
        const next = cloneSerialisable(event) || null;
        if (!next || typeof next !== 'object' || Array.isArray(next)) return null;
        const operation = createOperation('eventLog.append', { event: next }, syncState);
        queueOperation(operation);
        kickQueue();
        return cloneSerialisable(next);
      },
      list(learnerId = null) {
        const events = Array.isArray(cache.eventLog) ? cache.eventLog : [];
        return cloneSerialisable(learnerId ? events.filter((event) => event?.learnerId === learnerId) : events);
      },
      clearLearner(learnerId) {
        const operation = createOperation('eventLog.clearLearner', { learnerId }, syncState);
        queueOperation(operation);
        kickQueue();
      },
    },
  };

  return validatePlatformRepositories(repositories);
}
