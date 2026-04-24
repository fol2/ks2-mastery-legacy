import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';


function seedAdultAccount(server, {
  id,
  email,
  displayName,
  platformRole = 'parent',
  selectedLearnerId = null,
  repoRevision = 0,
  now = Date.now(),
} = {}) {
  server.DB.db.prepare(`
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at, repo_revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, displayName, platformRole, selectedLearnerId, now, now, repoRevision);
}

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


test('worker bootstrap stays writable-only while viewer learners remain readable through adult hub routes', async () => {
  const server = createWorkerRepositoryServer();
  const ownerRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-owner', { platformRole: 'parent' }),
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
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at, repo_revision)
    VALUES ('adult-viewer', 'viewer@example.test', 'Viewer', 'parent', 'learner-a', ${nowTs}, ${nowTs}, 0);
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at, repo_revision)
    VALUES ('adult-ops-viewer', 'ops-viewer@example.test', 'Ops Viewer', 'ops', 'learner-a', ${nowTs}, ${nowTs}, 0);
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES ('adult-viewer', 'learner-a', 'viewer', 0, ${nowTs}, ${nowTs});
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES ('adult-ops-viewer', 'learner-a', 'viewer', 0, ${nowTs}, ${nowTs});
  `);

  const viewerRepositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-viewer', { platformRole: 'parent' }),
  });
  await viewerRepositories.hydrate();
  assert.deepEqual(viewerRepositories.learners.read().allIds, []);

  const parentHubResponse = await server.fetchAs('adult-viewer', 'https://repo.test/api/hubs/parent?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const parentHubPayload = await parentHubResponse.json();
  assert.equal(parentHubResponse.status, 200);
  assert.equal(parentHubPayload.parentHub.permissions.membershipRole, 'viewer');
  assert.equal(parentHubPayload.parentHub.permissions.canMutateLearnerData, false);

  const adminHubResponse = await server.fetchAs('adult-ops-viewer', 'https://repo.test/api/hubs/admin?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'ops',
  });
  const adminHubPayload = await adminHubResponse.json();
  assert.equal(adminHubResponse.status, 200);
  assert.equal(adminHubPayload.adminHub.learnerSupport.selectedDiagnostics.membershipRole, 'viewer');
  assert.equal(adminHubPayload.adminHub.learnerSupport.selectedDiagnostics.writable, false);

  server.close();
});


test('brand-new signed-in parent hydrate stays honest while no writable learner exists yet', async () => {
  const server = createWorkerRepositoryServer();
  const nowTs = Date.now();
  seedAdultAccount(server, {
    id: 'adult-brand-new',
    email: 'brand-new@example.test',
    displayName: 'Brand New Parent',
    platformRole: 'parent',
    now: nowTs,
  });

  const firstClient = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-brand-new', { platformRole: 'parent' }),
  });
  await firstClient.hydrate();
  assert.deepEqual(firstClient.learners.read(), {
    byId: {},
    allIds: [],
    selectedId: null,
  });

  const reloadedClient = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-brand-new', { platformRole: 'parent' }),
  });
  await reloadedClient.hydrate();
  assert.deepEqual(reloadedClient.learners.read().allIds, []);
  assert.equal(reloadedClient.learners.read().selectedId, null);

  const parentHubResponse = await server.fetchAs('adult-brand-new', 'https://repo.test/api/hubs/parent', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const parentHubPayload = await parentHubResponse.json();

  assert.equal(parentHubResponse.status, 404);
  assert.equal(parentHubPayload.code, 'parent_hub_missing_learner');

  server.close();
});

test('creating a first learner through the learners boundary produces a real writable bootstrap state', async () => {
  const server = createWorkerRepositoryServer();
  const nowTs = Date.now();
  seedAdultAccount(server, {
    id: 'adult-first',
    email: 'first@example.test',
    displayName: 'First Parent',
    platformRole: 'parent',
    now: nowTs,
  });

  const sessionResponse = await server.fetchAs('adult-first', 'https://repo.test/api/session', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const sessionPayload = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionPayload.account.repoRevision, 0);

  const learnerSnapshot = {
    byId: {
      'learner-first': {
        id: 'learner-first',
        name: 'Ava',
        yearGroup: 'Y4',
        goal: 'sats',
        dailyMinutes: 15,
        avatarColor: '#3E6FA8',
        createdAt: nowTs,
      },
    },
    allIds: ['learner-first'],
    selectedId: 'learner-first',
  };

  const createResponse = await server.fetchAs('adult-first', 'https://repo.test/api/learners', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      learners: learnerSnapshot,
      mutation: {
        requestId: 'req-create-first',
        correlationId: 'req-create-first',
        expectedAccountRevision: Number(sessionPayload.account.repoRevision) || 0,
      },
    }),
  }, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const createPayload = await createResponse.json();

  assert.equal(createResponse.status, 200);
  assert.deepEqual(createPayload.learners.allIds, ['learner-first']);
  assert.equal(createPayload.learners.selectedId, 'learner-first');
  assert.equal(createPayload.syncState.accountRevision, 1);

  const freshClient = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-first', { platformRole: 'parent' }),
  });
  await freshClient.hydrate();
  assert.deepEqual(freshClient.learners.read().allIds, ['learner-first']);
  assert.equal(freshClient.learners.read().selectedId, 'learner-first');
  assert.equal(freshClient.learners.read().byId['learner-first'].name, 'Ava');

  const membershipRow = server.DB.db.prepare(`
    SELECT role FROM account_learner_memberships WHERE account_id = 'adult-first' AND learner_id = 'learner-first'
  `).get();
  assert.equal(membershipRow.role, 'owner');

  const accountRow = server.DB.db.prepare(`
    SELECT selected_learner_id, repo_revision FROM adult_accounts WHERE id = 'adult-first'
  `).get();
  assert.equal(accountRow.selected_learner_id, 'learner-first');
  assert.equal(Number(accountRow.repo_revision), 1);

  server.close();
});
