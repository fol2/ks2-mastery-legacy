import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasWritableLearnerSnapshot,
  resolveSignedInZeroWritableHome,
  zeroWritableSubjectRedirectMessage,
} from '../src/platform/access/zero-writable-shell.js';

test('brand-new signed-in parent with no readable learner context resolves to create-first-learner onboarding', () => {
  const outcome = resolveSignedInZeroWritableHome({
    platformRole: 'parent',
    parentHubErrorCode: 'parent_hub_missing_learner',
    parentHubStatusCode: 404,
  });

  assert.deepEqual(outcome, {
    screen: 'zero-writable',
    mode: 'create-first-learner',
    reason: 'parent_missing_readable_learner',
  });
});

test('viewer-only signed-in parent resolves to Parent Hub instead of a writable dashboard route', () => {
  const outcome = resolveSignedInZeroWritableHome({
    platformRole: 'parent',
    parentHubPayload: {
      parentHub: {
        permissions: {
          canViewParentHub: true,
        },
        accessibleLearners: [
          {
            learnerId: 'learner-a',
            learnerName: 'Ava',
            membershipRole: 'viewer',
            writable: false,
          },
        ],
      },
    },
  });

  assert.deepEqual(outcome, {
    screen: 'parent-hub',
    mode: 'parent-readable',
    reason: 'parent_readable_memberships',
  });
});

test('admin or operations zero-writable accounts resolve to Admin / Operations', () => {
  const adminOutcome = resolveSignedInZeroWritableHome({ platformRole: 'admin' });
  const opsOutcome = resolveSignedInZeroWritableHome({ platformRole: 'ops' });

  assert.equal(adminOutcome.screen, 'admin-hub');
  assert.equal(adminOutcome.mode, 'admin-operations');
  assert.equal(opsOutcome.screen, 'admin-hub');
  assert.equal(opsOutcome.mode, 'admin-operations');
});

test('subject reroute copy stays explicit when no writable learner exists', () => {
  assert.match(zeroWritableSubjectRedirectMessage('parent'), /no writable learner/i);
  assert.match(zeroWritableSubjectRedirectMessage('parent'), /create your first learner/i);
  assert.match(zeroWritableSubjectRedirectMessage('ops'), /Admin \/ Operations/i);
});

test('writable learner detection stays false for zero-writable snapshots and true for owner-member snapshots', () => {
  assert.equal(hasWritableLearnerSnapshot({ byId: {}, allIds: [], selectedId: null }), false);
  assert.equal(hasWritableLearnerSnapshot({
    byId: {
      'learner-a': {
        id: 'learner-a',
        name: 'Ava',
      },
    },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  }), true);
});
