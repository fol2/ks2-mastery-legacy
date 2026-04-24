import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createApiPlatformRepositories,
  createStaticHeaderRepositoryAuthSession,
} from '../src/platform/core/repositories/index.js';
import { createAppHarness } from './helpers/app-harness.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { createMockRepositoryServer } from './helpers/mock-api-server.js';

async function waitForPersistenceIdle(repositories, attempts = 25) {
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

test('remote write failure is surfaced as degraded persistence instead of pretending the write succeeded', async () => {
  const storage = installMemoryStorage();
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage,
  });

  await repositories.hydrate();
  server.failNext('PUT', '/api/learners', {
    status: 503,
    body: { ok: false, message: 'remote unavailable' },
  });

  repositories.learners.write(learnerSnapshot());
  await waitForPersistenceIdle(repositories);

  const snapshot = repositories.persistence.read();
  assert.equal(snapshot.mode, 'degraded');
  assert.equal(snapshot.remoteAvailable, true);
  assert.equal(snapshot.trustedState, 'local-cache');
  assert.equal(snapshot.cacheState, 'ahead-of-remote');
  assert.equal(snapshot.pendingWriteCount, 1);
  assert.equal(snapshot.inFlightWriteCount, 0);
  assert.equal(snapshot.lastError.retryable, true);
  assert.match(snapshot.lastError.message, /remote unavailable/i);

  assert.equal(repositories.learners.read().selectedId, 'learner-a');
  assert.equal(server.store.learners.selectedId, null);
});

test('retryable remote failures can leave degraded mode and clear pending writes once sync succeeds', async () => {
  const storage = installMemoryStorage();
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage,
  });

  await repositories.hydrate();
  server.failNext('PUT', '/api/learners', {
    status: 503,
    body: { ok: false, message: 'try again later' },
  });

  repositories.learners.write(learnerSnapshot());
  await waitForPersistenceIdle(repositories);
  assert.equal(repositories.persistence.read().mode, 'degraded');
  assert.equal(server.store.learners.selectedId, null);

  const afterRetry = await repositories.persistence.retry();

  assert.equal(afterRetry.mode, 'remote-sync');
  assert.equal(afterRetry.trustedState, 'remote');
  assert.equal(afterRetry.cacheState, 'aligned');
  assert.equal(afterRetry.pendingWriteCount, 0);
  assert.equal(server.store.learners.selectedId, 'learner-a');

  const restored = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage: installMemoryStorage(),
  });
  await restored.hydrate();
  assert.equal(restored.learners.read().selectedId, 'learner-a');
});

test('successful sync logging is quiet by default and available behind the debug flag', async () => {
  const originalInfo = globalThis.console.info;
  const originalDebugFlag = globalThis.KS2_SYNC_DEBUG;
  const messages = [];
  globalThis.console.info = (...args) => messages.push(args);
  delete globalThis.KS2_SYNC_DEBUG;

  try {
    const quietServer = createMockRepositoryServer();
    const quietRepositories = createApiPlatformRepositories({
      baseUrl: 'https://repo.test',
      fetch: quietServer.fetch.bind(quietServer),
      storage: installMemoryStorage(),
    });

    await quietRepositories.hydrate();
    quietRepositories.learners.write(learnerSnapshot());
    await waitForPersistenceIdle(quietRepositories);

    assert.equal(messages.length, 0);

    globalThis.KS2_SYNC_DEBUG = true;
    const debugServer = createMockRepositoryServer();
    const debugRepositories = createApiPlatformRepositories({
      baseUrl: 'https://repo.test',
      fetch: debugServer.fetch.bind(debugServer),
      storage: installMemoryStorage(),
    });

    await debugRepositories.hydrate();
    debugRepositories.learners.write(learnerSnapshot());
    await waitForPersistenceIdle(debugRepositories);

    assert.equal(messages.some((args) => String(args[0]).includes('[ks2-sync]')), true);
    assert.equal(messages.some((args) => String(args[1]).includes('sync.operation_applied')), true);
  } finally {
    globalThis.console.info = originalInfo;
    if (originalDebugFlag === undefined) {
      delete globalThis.KS2_SYNC_DEBUG;
    } else {
      globalThis.KS2_SYNC_DEBUG = originalDebugFlag;
    }
  }
});

test('in-flight remote writes stay in remote-sync mode instead of showing degraded', async () => {
  const storage = installMemoryStorage();
  const server = createMockRepositoryServer();
  let releaseWrite;
  let writeStarted;
  const writeStartedPromise = new Promise((resolve) => {
    writeStarted = resolve;
  });
  const releaseWritePromise = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'https://repo.test');
    const method = String(init.method || 'GET').toUpperCase();
    if (url.pathname === '/api/learners' && method === 'PUT') {
      writeStarted();
      await releaseWritePromise;
    }
    return server.fetch(input, init);
  };
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch,
    storage,
  });

  await repositories.hydrate();
  repositories.learners.write(learnerSnapshot());
  await writeStartedPromise;

  const inFlight = repositories.persistence.read();
  assert.equal(inFlight.mode, 'remote-sync');
  assert.equal(inFlight.remoteAvailable, true);
  assert.equal(inFlight.trustedState, 'local-cache');
  assert.equal(inFlight.cacheState, 'ahead-of-remote');
  assert.equal(inFlight.pendingWriteCount, 1);
  assert.equal(inFlight.lastError, null);

  releaseWrite();
  await waitForPersistenceIdle(repositories);

  const afterWrite = repositories.persistence.read();
  assert.equal(afterWrite.mode, 'remote-sync');
  assert.equal(afterWrite.trustedState, 'remote');
  assert.equal(afterWrite.pendingWriteCount, 0);
});

test('reload after failed sync keeps the local cache ahead of stale remote data instead of losing the unsynced change', async () => {
  const sharedStorage = installMemoryStorage();
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage: sharedStorage,
  });

  await repositories.hydrate();
  server.failNext('PUT', '/api/learners', {
    status: 503,
    body: { ok: false, message: 'write failed' },
  });

  repositories.learners.write(learnerSnapshot());
  await waitForPersistenceIdle(repositories);
  assert.equal(server.store.learners.selectedId, null);

  const restored = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage: sharedStorage,
  });
  await restored.hydrate();

  assert.equal(restored.learners.read().selectedId, 'learner-a');
  assert.equal(server.store.learners.selectedId, null);
  assert.equal(restored.persistence.read().mode, 'degraded');
  assert.equal(restored.persistence.read().trustedState, 'local-cache');
  assert.equal(restored.persistence.read().cacheState, 'ahead-of-remote');
  assert.equal(restored.persistence.read().pendingWriteCount, 1);
});

test('degraded persistence is rendered as explicit shell feedback and clears once sync is restored', async () => {
  const storage = installMemoryStorage();
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage,
  });

  await repositories.hydrate();
  server.failNext('PUT', '/api/learners', {
    status: 503,
    body: { ok: false, message: 'worker offline' },
  });

  repositories.learners.write(learnerSnapshot());
  await waitForPersistenceIdle(repositories);

  const harness = createAppHarness({ repositories });
  const degradedHtml = harness.render();
  assert.match(degradedHtml, /Sync degraded/);
  assert.match(degradedHtml, /Trusted: local cache/);
  assert.match(degradedHtml, /server may be behind/i);
  assert.match(degradedHtml, /Retry sync/);

  await repositories.persistence.retry();
  const healthyHtml = harness.render();
  assert.doesNotMatch(healthyHtml, /Sync degraded/);
  assert.match(healthyHtml, /Remote sync/);
});

test('api cache is scoped by auth session so degraded fallback does not leak between accounts', async () => {
  const storage = installMemoryStorage();
  const server = createMockRepositoryServer();
  const repoA = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage,
    authSession: createStaticHeaderRepositoryAuthSession({
      cacheScopeKey: 'account:a',
      headers: { 'x-ks2-dev-account-id': 'adult-a' },
    }),
  });

  await repoA.hydrate();
  server.failNext('PUT', '/api/learners', {
    status: 503,
    body: { ok: false, message: 'write failed' },
  });
  repoA.learners.write(learnerSnapshot());
  await waitForPersistenceIdle(repoA);
  assert.equal(repoA.persistence.read().mode, 'degraded');

  server.failNext('GET', '/api/bootstrap', {
    status: 503,
    body: { ok: false, message: 'bootstrap unavailable' },
  });

  const repoB = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    storage,
    authSession: createStaticHeaderRepositoryAuthSession({
      cacheScopeKey: 'account:b',
      headers: { 'x-ks2-dev-account-id': 'adult-b' },
    }),
  });

  await assert.rejects(() => repoB.hydrate(), /bootstrap unavailable/i);
});
