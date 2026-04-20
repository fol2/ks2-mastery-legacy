import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

test('worker repository routes require an authenticated adult session', async () => {
  const server = createWorkerRepositoryServer();
  const response = await server.fetchRaw('https://repo.test/api/bootstrap');
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, 'unauthenticated');

  server.close();
});

test('worker enforces learner ownership at the API boundary', async () => {
  const server = createWorkerRepositoryServer();
  const ownerRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  await ownerRepositories.hydrate();
  ownerRepositories.learners.write({
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
  });
  await ownerRepositories.flush();

  const outsiderResponse = await server.fetchAs('adult-b', 'https://repo.test/api/child-subject-state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      learnerId: 'learner-a',
      subjectId: 'spelling',
      record: { ui: { phase: 'dashboard' }, data: {}, updatedAt: 1 },
      mutation: { requestId: 'outsider-write', correlationId: 'outsider-write', expectedLearnerRevision: 0 },
    }),
  });
  const outsiderPayload = await outsiderResponse.json();

  assert.equal(outsiderResponse.status, 403);
  assert.equal(outsiderPayload.code, 'forbidden');

  server.close();
});

test('worker bootstrap stays account-scoped even when multiple accounts exist', async () => {
  const server = createWorkerRepositoryServer();
  const ownerA = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  const ownerB = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-b'),
  });

  await ownerA.hydrate();
  ownerA.learners.write({
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
  });
  await ownerA.flush();

  await ownerB.hydrate();
  ownerB.learners.write({
    byId: {
      'learner-b': {
        id: 'learner-b',
        name: 'Ben',
        yearGroup: 'Y6',
        goal: 'confidence',
        dailyMinutes: 10,
        avatarColor: '#335577',
        createdAt: 2,
      },
    },
    allIds: ['learner-b'],
    selectedId: 'learner-b',
  });
  await ownerB.flush();

  const rehydratedA = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  await rehydratedA.hydrate();

  const snapshotA = rehydratedA.learners.read();
  assert.deepEqual(snapshotA.allIds, ['learner-a']);
  assert.equal(snapshotA.byId['learner-b'], undefined);

  server.close();
});

test('worker shared memberships allow member write access without widening the browser contract', async () => {
  const server = createWorkerRepositoryServer();
  const ownerRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });

  await ownerRepositories.hydrate();
  ownerRepositories.learners.write({
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
  });
  await ownerRepositories.flush();

  const nowTs = Date.now();
  server.DB.db.exec(`
    INSERT INTO adult_accounts (id, email, display_name, created_at, updated_at)
    VALUES ('adult-b', 'b@example.test', 'Adult B', ${nowTs}, ${nowTs});
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES ('adult-b', 'learner-a', 'member', 0, ${nowTs}, ${nowTs});
  `);

  const memberRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-b'),
  });
  await memberRepositories.hydrate();

  assert.deepEqual(memberRepositories.learners.read().allIds, ['learner-a']);
  memberRepositories.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  await memberRepositories.flush();
  assert.deepEqual(ownerRepositories.subjectStates.read('learner-a', 'spelling').data, {});

  const refreshedOwner = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  await refreshedOwner.hydrate();
  assert.deepEqual(refreshedOwner.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });

  server.close();
});

test('removing the last owner promotes an existing member instead of orphaning the learner', async () => {
  const server = createWorkerRepositoryServer();
  const ownerRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });

  await ownerRepositories.hydrate();
  ownerRepositories.learners.write({
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
  });
  await ownerRepositories.flush();

  const nowTs = Date.now();
  server.DB.db.exec(`
    INSERT INTO adult_accounts (id, email, display_name, created_at, updated_at)
    VALUES ('adult-b', 'b@example.test', 'Adult B', ${nowTs}, ${nowTs});
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES ('adult-b', 'learner-a', 'member', 0, ${nowTs}, ${nowTs});
  `);

  ownerRepositories.learners.write({ byId: {}, allIds: [], selectedId: null });
  await ownerRepositories.flush();

  const ownerBootstrap = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  await ownerBootstrap.hydrate();
  assert.deepEqual(ownerBootstrap.learners.read().allIds, []);

  const promotedResponse = await server.fetchAs('adult-b', 'https://repo.test/api/session');
  const promotedPayload = await promotedResponse.json();
  assert.equal(promotedResponse.status, 200);

  const roleRow = server.DB.db.prepare(`
    SELECT role FROM account_learner_memberships WHERE account_id = 'adult-b' AND learner_id = 'learner-a'
  `).get();
  assert.equal(roleRow.role, 'owner');

  const promotedRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-b'),
  });
  await promotedRepositories.hydrate();
  assert.deepEqual(promotedRepositories.learners.read().allIds, ['learner-a']);
  assert.equal(promotedPayload.learnerCount, 1);

  server.close();
});
