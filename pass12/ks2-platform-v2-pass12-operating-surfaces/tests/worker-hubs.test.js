import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

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
