import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createApiPlatformRepositories,
  createLocalPlatformRepositories,
} from '../src/platform/core/repositories/index.js';
import { createAppHarness } from './helpers/app-harness.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

async function waitForPersistenceIdle(repositories, attempts = 60) {
  await Promise.resolve();
  for (let index = 0; index < attempts; index += 1) {
    if (repositories.persistence.read().inFlightWriteCount === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function learnerSnapshot() {
  return {
    byId: {
      'learner-a': {
        id: 'learner-a',
        name: 'Ava',
        yearGroup: 'Y5',
        goal: 'sats',
        dailyMinutes: 15,
        avatarColor: '#3E6FA8',
        createdAt: 1,
      },
    },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  };
}

function createRemoteRepositories(server, {
  storage = installMemoryStorage(),
  accountId = 'adult-a',
  fetch = server.fetch.bind(server),
} = {}) {
  return createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch,
    storage,
    authSession: server.authSessionFor(accountId),
  });
}

async function seedLearner(server, accountId = 'adult-a') {
  const repositories = createRemoteRepositories(server, { accountId });
  await repositories.hydrate();
  repositories.learners.write(learnerSnapshot());
  await repositories.flush();
  return repositories;
}

function createRouteFailureFetch(server, matcher, { message = 'forced network failure', afterCommit = false } = {}) {
  let remaining = 1;
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'https://repo.test');
    const method = String(init?.method || 'GET').toUpperCase();
    if (remaining > 0 && matcher({ url, method, input, init })) {
      remaining -= 1;
      if (afterCommit) {
        await server.fetch(input, init);
      }
      throw new Error(message);
    }
    return server.fetch(input, init);
  };
}

function normalisedLearnersSnapshot(snapshot) {
  return {
    byId: Object.fromEntries(Object.entries(snapshot.byId || {}).map(([learnerId, learner]) => [learnerId, {
      ...learner,
      createdAt: '[timestamp]',
    }])),
    allIds: snapshot.allIds || [],
    selectedId: snapshot.selectedId || null,
  };
}

function normalisedEventLog(events) {
  return (Array.isArray(events) ? events : []).map((event) => ({
    ...event,
    subjectId: event?.subjectId ?? undefined,
    systemId: event?.systemId ?? undefined,
  }));
}

function coreSnapshot(repositories) {
  const learners = normalisedLearnersSnapshot(repositories.learners.read());
  const learnerIds = learners.allIds.slice();
  return {
    learners,
    subjectStates: Object.fromEntries(learnerIds.map((learnerId) => [learnerId, repositories.subjectStates.readForLearner(learnerId)])),
    practiceSessions: learnerIds.flatMap((learnerId) => repositories.practiceSessions.list(learnerId))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    gameState: Object.fromEntries(learnerIds.map((learnerId) => [learnerId, repositories.gameState.readForLearner(learnerId)])),
    eventLog: Object.fromEntries(learnerIds.map((learnerId) => [learnerId, normalisedEventLog(repositories.eventLog.list(learnerId))])),
  };
}

function applyCoreWrites(repositories) {
  repositories.learners.write(learnerSnapshot());
  repositories.subjectStates.writeRecord('learner-a', 'spelling', {
    ui: { phase: 'dashboard', methodTab: 'review', error: '' },
    data: {
      prefs: { mode: 'smart', length: 10 },
      progress: { possess: { stage: 2, seen: 5 } },
    },
    updatedAt: 10,
  });
  repositories.practiceSessions.write({
    id: 'session-a',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'active',
    sessionState: { phase: 'session', word: 'possess' },
    summary: null,
    createdAt: 10,
    updatedAt: 10,
  });
  repositories.gameState.write('learner-a', 'monster-codex', {
    inklet: {
      caught: true,
      mastered: ['possess'],
    },
  });
  repositories.eventLog.append({
    id: 'evt-1',
    learnerId: 'learner-a',
    type: 'spelling.word-secured',
    createdAt: 11,
  });
}

test('duplicate learner-scoped writes are replayed safely and do not append twice', async () => {
  const server = createWorkerRepositoryServer();
  const repositories = await seedLearner(server);
  await repositories.flush();

  const body = {
    event: {
      id: 'evt-duplicate',
      learnerId: 'learner-a',
      type: 'spelling.word-secured',
      createdAt: 12,
    },
    mutation: {
      requestId: 'req-duplicate',
      correlationId: 'corr-duplicate',
      expectedLearnerRevision: 0,
    },
  };

  const responseA = await server.fetch('https://repo.test/api/event-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payloadA = await responseA.json();

  const responseB = await server.fetch('https://repo.test/api/event-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payloadB = await responseB.json();

  assert.equal(responseA.status, 200);
  assert.equal(payloadA.mutation.replayed, false);
  assert.equal(responseB.status, 200);
  assert.equal(payloadB.mutation.replayed, true);
  assert.equal(payloadB.mutation.appliedRevision, 1);

  const countRow = server.DB.db.prepare(`SELECT COUNT(*) AS count FROM event_log WHERE learner_id = 'learner-a'`).get();
  const revisionRow = server.DB.db.prepare(`SELECT state_revision FROM learner_profiles WHERE id = 'learner-a'`).get();
  assert.equal(countRow.count, 1);
  assert.equal(revisionRow.state_revision, 1);

  server.close();
});

test('reusing a mutation request id for different payloads is rejected explicitly', async () => {
  const server = createWorkerRepositoryServer();
  const repositories = await seedLearner(server);
  await repositories.flush();

  const firstBody = {
    learnerId: 'learner-a',
    subjectId: 'spelling',
    record: { ui: { phase: 'dashboard' }, data: { prefs: { mode: 'smart' } }, updatedAt: 12 },
    mutation: {
      requestId: 'req-reuse',
      correlationId: 'corr-reuse',
      expectedLearnerRevision: 0,
    },
  };
  const secondBody = {
    learnerId: 'learner-a',
    subjectId: 'spelling',
    record: { ui: { phase: 'dashboard' }, data: { prefs: { mode: 'single' } }, updatedAt: 13 },
    mutation: {
      requestId: 'req-reuse',
      correlationId: 'corr-reuse',
      expectedLearnerRevision: 0,
    },
  };

  const responseA = await server.fetch('https://repo.test/api/child-subject-state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(firstBody),
  });
  assert.equal(responseA.status, 200);

  const responseB = await server.fetch('https://repo.test/api/child-subject-state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(secondBody),
  });
  const payloadB = await responseB.json();

  assert.equal(responseB.status, 409);
  assert.equal(payloadB.code, 'idempotency_reuse');
  assert.match(payloadB.message, /request id/i);

  const row = server.DB.db.prepare(`SELECT data_json FROM child_subject_state WHERE learner_id = 'learner-a' AND subject_id = 'spelling'`).get();
  assert.equal(JSON.parse(row.data_json).prefs.mode, 'smart');
  const revisionRow = server.DB.db.prepare(`SELECT state_revision FROM learner_profiles WHERE id = 'learner-a'`).get();
  assert.equal(revisionRow.state_revision, 1);

  server.close();
});

test('stale learner writes are blocked explicitly and retry reloads the latest remote state', async () => {
  const server = createWorkerRepositoryServer();
  const repoA = await seedLearner(server, 'adult-a');
  const repoB = createRemoteRepositories(server, {
    accountId: 'adult-a',
    storage: installMemoryStorage(),
  });
  await repoB.hydrate();

  repoA.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  await repoA.flush();

  repoB.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'single' } });
  await waitForPersistenceIdle(repoB);

  const snapshot = repoB.persistence.read();
  assert.equal(snapshot.mode, 'degraded');
  assert.equal(snapshot.lastError.code, 'stale_write');
  assert.equal(snapshot.lastError.retryable, false);
  assert.equal(snapshot.pendingWriteCount, 1);
  assert.deepEqual(repoB.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'single' } });

  const harness = createAppHarness({ repositories: repoB });
  const html = harness.render();
  assert.match(html, /Another tab or device changed this learner/i);
  assert.match(html, /discard the blocked local change/i);

  await repoB.persistence.retry();
  assert.equal(repoB.persistence.read().mode, 'remote-sync');
  assert.deepEqual(repoB.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });

  server.close();
});

test('interrupted post-commit session writes resume safely and do not leave the client revision ahead', async () => {
  const server = createWorkerRepositoryServer();
  const sharedStorage = installMemoryStorage();
  const flakyFetch = createRouteFailureFetch(server, ({ url, method }) => method === 'PUT' && url.pathname === '/api/practice-sessions', {
    message: 'network dropped after commit',
    afterCommit: true,
  });
  const flakyRepo = createRemoteRepositories(server, {
    storage: sharedStorage,
    fetch: flakyFetch,
  });

  await flakyRepo.hydrate();
  flakyRepo.learners.write(learnerSnapshot());
  await flakyRepo.flush();

  flakyRepo.practiceSessions.write({
    id: 'session-interrupted',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'active',
    sessionState: { phase: 'session', cursor: 2 },
    summary: null,
    createdAt: 20,
    updatedAt: 20,
  });
  await waitForPersistenceIdle(flakyRepo);

  assert.equal(flakyRepo.persistence.read().mode, 'degraded');
  assert.equal(flakyRepo.persistence.read().pendingWriteCount, 1);
  assert.equal(flakyRepo.practiceSessions.latest('learner-a', 'spelling').id, 'session-interrupted');

  const restored = createRemoteRepositories(server, {
    storage: sharedStorage,
    fetch: server.fetch.bind(server),
  });
  await restored.hydrate();
  assert.equal(restored.practiceSessions.latest('learner-a', 'spelling').id, 'session-interrupted');
  assert.equal(restored.persistence.read().mode, 'degraded');

  await restored.persistence.retry();
  assert.equal(restored.persistence.read().mode, 'remote-sync');
  assert.equal(restored.practiceSessions.latest('learner-a', 'spelling').status, 'active');

  restored.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  await restored.flush();
  assert.equal(restored.persistence.read().mode, 'remote-sync');
  assert.deepEqual(restored.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });

  const revisionRow = server.DB.db.prepare(`SELECT state_revision FROM learner_profiles WHERE id = 'learner-a'`).get();
  assert.equal(revisionRow.state_revision, 2);

  server.close();
});

test('transient partial failures preserve order so later learner writes do not leapfrog earlier failed ones', async () => {
  const server = createWorkerRepositoryServer();
  const flakyFetch = createRouteFailureFetch(server, ({ url, method }) => method === 'PUT' && url.pathname === '/api/practice-sessions', {
    message: 'transient practice write failure',
    afterCommit: false,
  });
  const repositories = createRemoteRepositories(server, {
    storage: installMemoryStorage(),
    fetch: flakyFetch,
  });

  await repositories.hydrate();
  repositories.learners.write(learnerSnapshot());
  await repositories.flush();

  repositories.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  repositories.practiceSessions.write({
    id: 'session-order',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'active',
    sessionState: { cursor: 1 },
    summary: null,
    createdAt: 30,
    updatedAt: 30,
  });
  repositories.gameState.write('learner-a', 'monster-codex', { inklet: { caught: true } });
  await waitForPersistenceIdle(repositories);

  assert.equal(repositories.persistence.read().mode, 'degraded');
  assert.equal(repositories.persistence.read().pendingWriteCount, 2);

  const remoteBeforeRetry = createRemoteRepositories(server, {
    storage: installMemoryStorage(),
    fetch: server.fetch.bind(server),
  });
  await remoteBeforeRetry.hydrate();
  assert.deepEqual(remoteBeforeRetry.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });
  assert.equal(remoteBeforeRetry.practiceSessions.latest('learner-a', 'spelling'), null);
  assert.deepEqual(remoteBeforeRetry.gameState.read('learner-a', 'monster-codex'), {});

  await repositories.persistence.retry();
  assert.equal(repositories.persistence.read().mode, 'remote-sync');

  const remoteAfterRetry = createRemoteRepositories(server, {
    storage: installMemoryStorage(),
    fetch: server.fetch.bind(server),
  });
  await remoteAfterRetry.hydrate();
  assert.equal(remoteAfterRetry.practiceSessions.latest('learner-a', 'spelling').id, 'session-order');
  assert.deepEqual(remoteAfterRetry.gameState.read('learner-a', 'monster-codex'), { inklet: { caught: true } });

  server.close();
});

test('local and real worker repositories stay in parity on the core generic collections', async () => {
  const server = createWorkerRepositoryServer();
  const localStorage = installMemoryStorage();
  const localRepositories = createLocalPlatformRepositories({ storage: localStorage });
  applyCoreWrites(localRepositories);
  await localRepositories.flush();
  const restoredLocal = createLocalPlatformRepositories({ storage: localStorage });

  const remoteRepositories = createRemoteRepositories(server, {
    storage: installMemoryStorage(),
    fetch: server.fetch.bind(server),
  });
  await remoteRepositories.hydrate();
  applyCoreWrites(remoteRepositories);
  await remoteRepositories.flush();
  const restoredRemote = createRemoteRepositories(server, {
    storage: installMemoryStorage(),
    fetch: server.fetch.bind(server),
  });
  await restoredRemote.hydrate();

  assert.deepEqual(coreSnapshot(restoredRemote), coreSnapshot(restoredLocal));

  server.close();
});
