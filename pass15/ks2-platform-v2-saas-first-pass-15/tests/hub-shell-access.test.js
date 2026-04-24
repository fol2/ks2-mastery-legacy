import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdminHubAccessContext,
  buildParentHubAccessContext,
  readOnlyLearnerActionBlockReason,
} from '../src/platform/hubs/shell-access.js';

test('parent hub access context reflects read-only viewer membership from remote payloads', () => {
  const payload = {
    learnerId: 'learner-a',
    parentHub: {
      learner: { id: 'learner-a', name: 'Ava' },
      permissions: {
        platformRole: 'parent',
        membershipRole: 'viewer',
        canMutateLearnerData: false,
      },
    },
  };

  const context = buildParentHubAccessContext(payload, 'learner-writable');

  assert.deepEqual(context, {
    surface: 'parent-hub',
    learnerId: 'learner-a',
    learnerName: 'Ava',
    membershipRole: 'viewer',
    membershipRoleLabel: 'Viewer',
    platformRole: 'parent',
    platformRoleLabel: 'Parent',
    writable: false,
    writableLabel: 'Read-only learner',
    separateFromWritable: true,
  });
});

test('admin hub access context reflects selected diagnostics learner from remote payloads', () => {
  const payload = {
    adminHub: {
      permissions: { platformRole: 'ops' },
      learnerSupport: {
        selectedDiagnostics: {
          learnerId: 'learner-b',
          learnerName: 'Ben',
          membershipRole: 'viewer',
          writable: false,
        },
      },
    },
  };

  const context = buildAdminHubAccessContext(payload, 'learner-a');

  assert.equal(context.surface, 'admin-hub');
  assert.equal(context.learnerId, 'learner-b');
  assert.equal(context.learnerName, 'Ben');
  assert.equal(context.membershipRole, 'viewer');
  assert.equal(context.membershipRoleLabel, 'Viewer');
  assert.equal(context.platformRole, 'ops');
  assert.equal(context.platformRoleLabel, 'Operations');
  assert.equal(context.writable, false);
  assert.equal(context.writableLabel, 'Read-only learner');
  assert.equal(context.separateFromWritable, true);
});

test('read-only learner contexts block write affordances while writable flows stay unblocked', () => {
  const viewerContext = {
    learnerName: 'Ava',
    writable: false,
  };
  const memberContext = {
    learnerName: 'Ava',
    writable: true,
  };

  assert.match(
    readOnlyLearnerActionBlockReason('open-subject', viewerContext),
    /Ava is read-only in this adult surface/i,
  );
  assert.match(
    readOnlyLearnerActionBlockReason('platform-reset-all', viewerContext),
    /blocked in read-only viewer context/i,
  );
  assert.equal(readOnlyLearnerActionBlockReason('open-subject', memberContext), '');
  assert.equal(readOnlyLearnerActionBlockReason('learner-save-form', null), '');
});
