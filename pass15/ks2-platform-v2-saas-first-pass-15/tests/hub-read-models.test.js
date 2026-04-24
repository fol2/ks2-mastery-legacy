import test from 'node:test';
import assert from 'node:assert/strict';

import { buildParentHubReadModel } from '../src/platform/hubs/parent-read-model.js';
import { buildAdminHubReadModel } from '../src/platform/hubs/admin-read-model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../src/subjects/spelling/data/content-data.js';

function makeLearner(id = 'learner-a', name = 'Ava') {
  return {
    id,
    name,
    yearGroup: 'Y5',
    goal: 'sats',
    dailyMinutes: 15,
    avatarColor: '#3E6FA8',
    createdAt: 1000,
  };
}

test('parent hub read model summarises due work, recent sessions, strengths, and misconception patterns', () => {
  const learner = makeLearner();
  const model = buildParentHubReadModel({
    learner,
    platformRole: 'parent',
    membershipRole: 'owner',
    subjectStates: {
      spelling: {
        ui: { phase: 'dashboard' },
        data: {
          prefs: { mode: 'trouble', yearFilter: 'all', roundLength: '20' },
          progress: {
            possess: { stage: 4, attempts: 4, correct: 4, wrong: 0, dueDay: 999999, lastDay: 200, lastResult: true },
            bicycle: { stage: 1, attempts: 3, correct: 1, wrong: 2, dueDay: 0, lastDay: 201, lastResult: false },
            ordinary: { stage: 2, attempts: 2, correct: 1, wrong: 1, dueDay: 0, lastDay: 202, lastResult: false },
          },
        },
        updatedAt: 2000,
      },
    },
    practiceSessions: [
      {
        id: 'sess-active',
        learnerId: learner.id,
        subjectId: 'spelling',
        sessionKind: 'learning',
        status: 'active',
        sessionState: { currentSlug: 'bicycle' },
        summary: null,
        createdAt: 3000,
        updatedAt: 4000,
      },
      {
        id: 'sess-complete',
        learnerId: learner.id,
        subjectId: 'spelling',
        sessionKind: 'learning',
        status: 'completed',
        sessionState: null,
        summary: {
          label: 'Trouble drill',
          cards: [{ label: 'Correct', value: '6/8' }],
          mistakes: [
            { slug: 'bicycle', word: 'bicycle', family: 'cycle', year: '5-6', yearLabel: 'Years 5-6', familyWords: [] },
          ],
        },
        createdAt: 2500,
        updatedAt: 3500,
      },
    ],
    eventLog: [
      {
        id: 'retry-1',
        type: 'spelling.retry-cleared',
        subjectId: 'spelling',
        learnerId: learner.id,
        family: 'cycle',
        yearBand: '5-6',
        createdAt: 3600,
      },
    ],
    runtimeSnapshots: {},
    now: () => 10 * 24 * 60 * 60 * 1000,
  });

  assert.equal(model.permissions.canViewParentHub, true);
  assert.equal(model.learnerOverview.secureWords, 1);
  assert.equal(model.learnerOverview.dueWords, 2);
  assert.equal(model.learnerOverview.troubleWords, 2);
  assert.match(model.dueWork[0].label, /Continue/i);
  assert.equal(model.recentSessions[0].id, 'sess-active');
  assert.ok(model.strengths.some((entry) => /possess/i.test(entry.label) || /family/i.test(entry.label)));
  assert.ok(model.weaknesses.some((entry) => /cycle/i.test(entry.label) || /family/i.test(entry.label)));
  assert.ok(model.misconceptionPatterns.some((entry) => /cycle/i.test(entry.label)));
});

test('admin hub read model reports published release status, validation state, audit stream, and learner diagnostics', () => {
  const learner = makeLearner();
  const model = buildAdminHubReadModel({
    account: {
      id: 'adult-admin',
      selectedLearnerId: learner.id,
      repoRevision: 7,
      platformRole: 'admin',
    },
    platformRole: 'admin',
    spellingContentBundle: SEEDED_SPELLING_CONTENT_BUNDLE,
    memberships: [
      {
        learnerId: learner.id,
        role: 'owner',
        stateRevision: 3,
        learner,
      },
    ],
    learnerBundles: {
      [learner.id]: {
        subjectStates: { spelling: { data: { progress: { possess: { stage: 4, attempts: 3, correct: 3, wrong: 0, dueDay: 99999 } } } } },
        practiceSessions: [],
        eventLog: [],
        gameState: {},
      },
    },
    runtimeSnapshots: {},
    auditEntries: [
      {
        requestId: 'req-1',
        mutationKind: 'learners.write',
        scopeType: 'account',
        scopeId: 'adult-admin',
        correlationId: 'req-1',
        appliedAt: 5000,
        statusCode: 200,
      },
    ],
    auditAvailable: true,
    selectedLearnerId: learner.id,
    now: () => 6000,
  });

  assert.equal(model.permissions.canViewAdminHub, true);
  assert.equal(model.contentReleaseStatus.subjectId, 'spelling');
  assert.equal(model.contentReleaseStatus.publishedVersion, 1);
  assert.equal(model.importValidationStatus.ok, true);
  assert.equal(model.auditLogLookup.available, true);
  assert.equal(model.auditLogLookup.entries[0].requestId, 'req-1');
  assert.equal(model.learnerSupport.accessibleLearners[0].learnerName, 'Ava');
  assert.equal(model.learnerSupport.selectedDiagnostics.overview.secureWords, 1);
});
