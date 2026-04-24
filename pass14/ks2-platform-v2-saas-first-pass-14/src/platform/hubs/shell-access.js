import {
  canMutateLearnerData,
  learnerMembershipRoleLabel,
  normaliseLearnerMembershipRole,
  normalisePlatformRole,
  platformRoleLabel,
} from '../access/roles.js';

function normaliseWritability(rawValue, membershipRole) {
  if (typeof rawValue === 'boolean') return rawValue;
  return canMutateLearnerData({ membershipRole });
}

function buildAccessContext({
  surface,
  learnerId,
  learnerName,
  membershipRole,
  platformRole,
  writable,
  writableSelectedId = null,
} = {}) {
  const resolvedMembershipRole = normaliseLearnerMembershipRole(membershipRole);
  const resolvedPlatformRole = normalisePlatformRole(platformRole);
  const resolvedLearnerId = typeof learnerId === 'string' ? learnerId : '';
  return {
    surface: surface || 'adult-hub',
    learnerId: resolvedLearnerId,
    learnerName: learnerName || 'Learner',
    membershipRole: resolvedMembershipRole,
    membershipRoleLabel: learnerMembershipRoleLabel(resolvedMembershipRole),
    platformRole: resolvedPlatformRole,
    platformRoleLabel: platformRoleLabel(resolvedPlatformRole),
    writable: normaliseWritability(writable, resolvedMembershipRole),
    writableLabel: normaliseWritability(writable, resolvedMembershipRole) ? 'Writable learner' : 'Read-only learner',
    separateFromWritable: Boolean(resolvedLearnerId && writableSelectedId && resolvedLearnerId !== writableSelectedId),
  };
}

export function buildParentHubAccessContext(responseOrModel, writableSelectedId = null) {
  const response = responseOrModel && typeof responseOrModel === 'object' && 'parentHub' in responseOrModel
    ? responseOrModel
    : { learnerId: responseOrModel?.learner?.id, parentHub: responseOrModel };
  const model = response?.parentHub;
  if (!model?.learner) return null;

  return buildAccessContext({
    surface: 'parent-hub',
    learnerId: response?.learnerId || model.learner.id,
    learnerName: model.learner.name,
    membershipRole: model.permissions?.membershipRole,
    platformRole: model.permissions?.platformRole,
    writable: model.permissions?.canMutateLearnerData,
    writableSelectedId,
  });
}

export function buildAdminHubAccessContext(responseOrModel, writableSelectedId = null) {
  const response = responseOrModel && typeof responseOrModel === 'object' && 'adminHub' in responseOrModel
    ? responseOrModel
    : { adminHub: responseOrModel };
  const model = response?.adminHub;
  const selectedDiagnostics = model?.learnerSupport?.selectedDiagnostics;
  if (!selectedDiagnostics) return null;

  return buildAccessContext({
    surface: 'admin-hub',
    learnerId: selectedDiagnostics.learnerId,
    learnerName: selectedDiagnostics.learnerName,
    membershipRole: selectedDiagnostics.membershipRole,
    platformRole: model.permissions?.platformRole,
    writable: selectedDiagnostics.writable,
    writableSelectedId,
  });
}

const READ_ONLY_BLOCKED_ACTIONS = new Map([
  ['open-subject', 'Subject tabs in the main shell still require owner or member learner access.'],
  ['learner-create', 'Creating learners is only available from a writable learner shell context.'],
  ['learner-save-form', 'Learner profile changes are blocked in read-only viewer context.'],
  ['learner-delete', 'Learner deletion is blocked in read-only viewer context.'],
  ['learner-reset-progress', 'Progress reset is blocked in read-only viewer context.'],
  ['platform-export-learner', 'Current-learner export is only available for writable learner shell context.'],
  ['platform-export-app', 'Full app export would not include read-only viewer learners in the writable shell dataset.'],
  ['platform-import', 'Import would mutate the writable shell dataset and is blocked in read-only viewer context.'],
  ['platform-reset-all', 'Platform reset would mutate the writable shell dataset and is blocked in read-only viewer context.'],
]);

export function readOnlyLearnerActionBlockReason(action, accessContext = null) {
  if (!accessContext || accessContext.writable !== false) return '';
  const suffix = READ_ONLY_BLOCKED_ACTIONS.get(String(action || ''));
  if (!suffix) return '';
  return `${accessContext.learnerName || 'This learner'} is read-only in this adult surface. ${suffix}`;
}
