import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

function seedAdultAccount(server, {
  id,
  email,
  displayName,
  platformRole = 'parent',
  provider = null,
  providerSubject = null,
  now = 1,
} = {}) {
  server.DB.db.prepare(`
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at, repo_revision)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 0)
  `).run(id, email, displayName, platformRole, now, now);

  if (provider) {
    server.DB.db.prepare(`
      INSERT INTO account_identities (id, account_id, provider, provider_subject, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`identity-${id}-${provider}`, id, provider, providerSubject || id, email, now, now);
  }
}

async function seedLearnerData(server, accountId, platformRole = 'parent') {
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor(accountId, { platformRole }),
  });
  await repositories.hydrate();
  repositories.learners.write({
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
  repositories.subjectStates.writeData('learner-a', 'spelling', {
    prefs: { mode: 'smart' },
    progress: {
      possess: { stage: 4, attempts: 4, correct: 4, wrong: 0, dueDay: 999999, lastDay: 10, lastResult: true },
      bicycle: { stage: 1, attempts: 3, correct: 1, wrong: 2, dueDay: 0, lastDay: 11, lastResult: false },
    },
  });
  repositories.practiceSessions.write({
    id: 'sess-parent',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'completed',
    sessionState: null,
    summary: {
      label: 'Smart review',
      cards: [{ label: 'Correct', value: '6/8' }],
      mistakes: [
        { slug: 'bicycle', word: 'bicycle', family: 'cycle', year: '5-6', yearLabel: 'Years 5-6', familyWords: [] },
      ],
    },
    createdAt: 10,
    updatedAt: 20,
  });
  repositories.eventLog.append({
    id: 'retry-parent',
    type: 'spelling.retry-cleared',
    subjectId: 'spelling',
    learnerId: 'learner-a',
    family: 'cycle',
    yearBand: '5-6',
    createdAt: 30,
  });
  await repositories.flush();
}

test('worker parent hub requires the parent platform role and readable learner membership', async () => {
  const server = createWorkerRepositoryServer();
  await seedLearnerData(server, 'adult-parent', 'parent');

  const allowedResponse = await server.fetchAs('adult-parent', 'https://repo.test/api/hubs/parent?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const allowedPayload = await allowedResponse.json();

  assert.equal(allowedResponse.status, 200);
  assert.equal(allowedPayload.parentHub.permissions.canViewParentHub, true);
  assert.equal(allowedPayload.parentHub.learnerOverview.dueWords, 1);
  assert.ok(allowedPayload.parentHub.misconceptionPatterns.some((entry) => /cycle/i.test(entry.label)));

  const deniedResponse = await server.fetchAs('adult-parent', 'https://repo.test/api/hubs/parent?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const deniedPayload = await deniedResponse.json();
  assert.equal(deniedResponse.status, 403);
  assert.equal(deniedPayload.code, 'parent_hub_forbidden');

  server.close();
});

test('worker admin account roles are listed and assignable by admins only', async () => {
  const server = createWorkerRepositoryServer();
  seedAdultAccount(server, {
    id: 'adult-admin',
    email: 'fol2hk@gmail.com',
    displayName: 'James',
    platformRole: 'admin',
    provider: 'google',
    providerSubject: 'google-james',
  });
  seedAdultAccount(server, {
    id: 'adult-parent',
    email: 'parent@example.com',
    displayName: 'Parent',
    platformRole: 'parent',
    provider: 'google',
    providerSubject: 'google-parent',
  });
  seedAdultAccount(server, {
    id: 'adult-ops',
    email: 'ops@example.com',
    displayName: 'Ops',
    platformRole: 'ops',
  });

  const listResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/admin/accounts', {}, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const listPayload = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.currentAccount.platformRole, 'admin');
  assert.ok(listPayload.accounts.some((account) => (
    account.id === 'adult-admin'
    && account.email === 'fol2hk@gmail.com'
    && account.platformRole === 'admin'
    && account.providers.includes('google')
  )));

  const deniedList = await server.fetchAs('adult-ops', 'https://repo.test/api/admin/accounts', {}, {
    'x-ks2-dev-platform-role': 'ops',
  });
  const deniedListPayload = await deniedList.json();
  assert.equal(deniedList.status, 403);
  assert.equal(deniedListPayload.code, 'account_roles_forbidden');

  const updateResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/admin/accounts/role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: 'adult-parent',
      platformRole: 'ops',
      requestId: 'role-change-1',
    }),
  }, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const updatePayload = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.updatedAccount.platformRole, 'ops');
  assert.ok(updatePayload.accounts.some((account) => account.id === 'adult-parent' && account.platformRole === 'ops'));

  const storedRole = server.DB.db.prepare('SELECT platform_role FROM adult_accounts WHERE id = ?').get('adult-parent')?.platform_role;
  assert.equal(storedRole, 'ops');
  const receipt = server.DB.db.prepare('SELECT mutation_kind, scope_id FROM mutation_receipts WHERE request_id = ?').get('role-change-1');
  assert.equal(receipt?.mutation_kind, 'admin.account_role.update');
  assert.equal(receipt?.scope_id, 'adult-parent');

  const replayResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/admin/accounts/role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: 'adult-parent',
      platformRole: 'ops',
      requestId: 'role-change-1',
    }),
  }, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const replayPayload = await replayResponse.json();
  assert.equal(replayResponse.status, 200);
  assert.equal(replayPayload.roleMutation.replayed, true);

  const deniedUpdate = await server.fetchAs('adult-ops', 'https://repo.test/api/admin/accounts/role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: 'adult-parent',
      platformRole: 'admin',
      requestId: 'role-change-denied',
    }),
  }, {
    'x-ks2-dev-platform-role': 'ops',
  });
  const deniedUpdatePayload = await deniedUpdate.json();
  assert.equal(deniedUpdate.status, 403);
  assert.equal(deniedUpdatePayload.code, 'account_roles_forbidden');

  server.close();
});

test('worker prevents demoting the last admin account', async () => {
  const server = createWorkerRepositoryServer();
  seedAdultAccount(server, {
    id: 'adult-admin',
    email: 'fol2hk@gmail.com',
    displayName: 'James',
    platformRole: 'admin',
    provider: 'google',
  });

  const blockedResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/admin/accounts/role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: 'adult-admin',
      platformRole: 'parent',
      requestId: 'role-demote-last-admin',
    }),
  }, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const blockedPayload = await blockedResponse.json();
  assert.equal(blockedResponse.status, 409);
  assert.equal(blockedPayload.code, 'last_admin_required');
  assert.equal(
    server.DB.db.prepare('SELECT platform_role FROM adult_accounts WHERE id = ?').get('adult-admin')?.platform_role,
    'admin',
  );

  seedAdultAccount(server, {
    id: 'adult-admin-2',
    email: 'second-admin@example.com',
    displayName: 'Second Admin',
    platformRole: 'admin',
  });

  const allowedResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/admin/accounts/role', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      accountId: 'adult-admin',
      platformRole: 'parent',
      requestId: 'role-demote-with-backup-admin',
    }),
  }, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const allowedPayload = await allowedResponse.json();
  assert.equal(allowedResponse.status, 200);
  assert.equal(allowedPayload.updatedAccount.platformRole, 'parent');

  server.close();
});

test('worker admin hub requires admin or operations role and exposes content plus audit summaries', async () => {
  const server = createWorkerRepositoryServer();
  await seedLearnerData(server, 'adult-admin', 'admin');

  const adminResponse = await server.fetchAs('adult-admin', 'https://repo.test/api/hubs/admin?learnerId=learner-a&auditLimit=10', {}, {
    'x-ks2-dev-platform-role': 'admin',
  });
  const adminPayload = await adminResponse.json();

  assert.equal(adminResponse.status, 200);
  assert.equal(adminPayload.adminHub.permissions.canViewAdminHub, true);
  assert.equal(adminPayload.adminHub.contentReleaseStatus.subjectId, 'spelling');
  assert.ok(adminPayload.adminHub.contentReleaseStatus.runtimeWordCount > 0);
  assert.ok(adminPayload.adminHub.auditLogLookup.entries.some((entry) => entry.mutationKind === 'learners.write'));
  assert.equal(adminPayload.adminHub.learnerSupport.accessibleLearners[0].learnerName, 'Ava');

  const parentDenied = await server.fetchAs('adult-admin', 'https://repo.test/api/hubs/admin', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const parentDeniedPayload = await parentDenied.json();
  assert.equal(parentDenied.status, 403);
  assert.equal(parentDeniedPayload.code, 'admin_hub_forbidden');

  server.close();
});


test('worker parent hub returns readable viewer learners with explicit read-only labels', async () => {
  const server = createWorkerRepositoryServer();
  await seedLearnerData(server, 'adult-owner', 'parent');
  seedAdultAccount(server, {
    id: 'adult-viewer',
    email: 'viewer@example.com',
    displayName: 'Viewer Parent',
    platformRole: 'parent',
    now: 50,
  });
  server.DB.db.prepare(`
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('adult-viewer', 'learner-a', 'viewer', 0, 50, 50);

  const response = await server.fetchAs('adult-viewer', 'https://repo.test/api/hubs/parent?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'parent',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.learnerId, 'learner-a');
  assert.equal(payload.parentHub.permissions.membershipRole, 'viewer');
  assert.equal(payload.parentHub.permissions.canMutateLearnerData, false);
  assert.equal(payload.parentHub.permissions.accessModeLabel, 'Read-only learner');
  assert.equal(payload.parentHub.selectedLearnerId, 'learner-a');
  assert.deepEqual(payload.parentHub.accessibleLearners.map((entry) => entry.learnerId), ['learner-a']);
  assert.equal(payload.parentHub.accessibleLearners[0].membershipRole, 'viewer');
  assert.equal(payload.parentHub.accessibleLearners[0].accessModeLabel, 'Read-only learner');

  server.close();
});

test('worker admin hub returns readable viewer diagnostics without inventing writable access', async () => {
  const server = createWorkerRepositoryServer();
  await seedLearnerData(server, 'adult-owner', 'parent');
  seedAdultAccount(server, {
    id: 'adult-ops',
    email: 'ops@example.com',
    displayName: 'Ops Viewer',
    platformRole: 'ops',
    now: 60,
  });
  server.DB.db.prepare(`
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('adult-ops', 'learner-a', 'viewer', 0, 60, 60);

  const response = await server.fetchAs('adult-ops', 'https://repo.test/api/hubs/admin?learnerId=learner-a', {}, {
    'x-ks2-dev-platform-role': 'ops',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.adminHub.permissions.canViewAdminHub, true);
  assert.equal(payload.adminHub.learnerSupport.selectedLearnerId, 'learner-a');
  assert.equal(payload.adminHub.learnerSupport.selectedDiagnostics.membershipRole, 'viewer');
  assert.equal(payload.adminHub.learnerSupport.selectedDiagnostics.writable, false);
  assert.equal(payload.adminHub.learnerSupport.selectedDiagnostics.accessModeLabel, 'Read-only learner');
  assert.equal(payload.adminHub.learnerSupport.accessibleLearners[0].membershipRoleLabel, 'Viewer');
  assert.equal(payload.adminHub.learnerSupport.accessibleLearners[0].accessModeLabel, 'Read-only learner');

  server.close();
});
