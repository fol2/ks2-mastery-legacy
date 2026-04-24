import { normalisePlatformRole } from './roles.js';

function readableLearnerCountFromParentHubPayload(parentHubPayload = null) {
  const accessibleLearners = Array.isArray(parentHubPayload?.parentHub?.accessibleLearners)
    ? parentHubPayload.parentHub.accessibleLearners
    : [];
  if (accessibleLearners.length) return accessibleLearners.length;
  return parentHubPayload?.parentHub?.learner?.id ? 1 : 0;
}

export function hasWritableLearnerSnapshot(appStateOrLearners = null) {
  const learners = appStateOrLearners && typeof appStateOrLearners === 'object' && 'learners' in appStateOrLearners
    ? appStateOrLearners.learners
    : appStateOrLearners;
  const byId = learners?.byId && typeof learners.byId === 'object' ? learners.byId : {};
  const allIds = Array.isArray(learners?.allIds) ? learners.allIds.filter((id) => Boolean(byId[id])) : [];
  const selectedId = typeof learners?.selectedId === 'string' ? learners.selectedId : '';
  if (selectedId && byId[selectedId]) return true;
  return allIds.length > 0;
}

export function resolveSignedInZeroWritableHome({
  platformRole = 'parent',
  parentHubPayload = null,
  parentHubErrorCode = '',
  parentHubStatusCode = 0,
} = {}) {
  const resolvedPlatformRole = normalisePlatformRole(platformRole);
  if (resolvedPlatformRole === 'admin' || resolvedPlatformRole === 'ops') {
    return {
      screen: 'admin-hub',
      mode: 'admin-operations',
      reason: 'admin_or_ops_zero_writable',
    };
  }

  const readableLearnerCount = readableLearnerCountFromParentHubPayload(parentHubPayload);
  const canViewParentHub = Boolean(parentHubPayload?.parentHub?.permissions?.canViewParentHub);
  if (canViewParentHub && readableLearnerCount > 0) {
    return {
      screen: 'parent-hub',
      mode: 'parent-readable',
      reason: 'parent_readable_memberships',
    };
  }

  if (String(parentHubErrorCode || '') === 'parent_hub_missing_learner') {
    return {
      screen: 'zero-writable',
      mode: 'create-first-learner',
      reason: 'parent_missing_readable_learner',
    };
  }

  if (String(parentHubErrorCode || '') === 'parent_hub_forbidden') {
    return {
      screen: 'zero-writable',
      mode: 'access-error',
      reason: 'parent_hub_forbidden',
    };
  }

  if (Number(parentHubStatusCode) >= 500 || parentHubErrorCode) {
    return {
      screen: 'zero-writable',
      mode: 'error',
      reason: 'parent_hub_error',
    };
  }

  return {
    screen: 'zero-writable',
    mode: 'resolving',
    reason: 'resolving_zero_writable_home',
  };
}

export function zeroWritableSubjectRedirectMessage(platformRole = 'parent') {
  const role = normalisePlatformRole(platformRole);
  if (role === 'admin' || role === 'ops') {
    return 'This signed-in account has no writable learner in the main shell, so subject tabs stay blocked and the shell routes back to Admin / Operations.';
  }
  return 'This signed-in account has no writable learner in the main shell, so subject tabs stay blocked until Parent Hub selects a readable learner or you create your first learner.';
}

export function zeroWritableHomeTitle(mode = 'resolving') {
  if (mode === 'create-first-learner') return 'Create your first learner';
  if (mode === 'admin-operations') return 'Operations is this account’s home surface';
  if (mode === 'parent-readable') return 'Parent Hub is this account’s home surface';
  if (mode === 'access-error') return 'This account cannot open that adult surface';
  if (mode === 'error') return 'Signed-in home could not be resolved';
  return 'Checking signed-in access';
}
