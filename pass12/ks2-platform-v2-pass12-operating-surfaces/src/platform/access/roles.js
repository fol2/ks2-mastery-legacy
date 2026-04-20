export const PLATFORM_ROLES = Object.freeze(['parent', 'admin', 'ops']);
export const LEARNER_MEMBERSHIP_ROLES = Object.freeze(['owner', 'member', 'viewer']);

const PARENT_HUB_PLATFORM_ROLES = new Set(['parent']);
const ADMIN_HUB_PLATFORM_ROLES = new Set(['admin', 'ops']);
const READABLE_MEMBERSHIP_ROLES = new Set(['owner', 'member', 'viewer']);
const WRITABLE_MEMBERSHIP_ROLES = new Set(['owner', 'member']);

export function normalisePlatformRole(value, fallback = 'parent') {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return PLATFORM_ROLES.includes(role) ? role : fallback;
}

export function normaliseLearnerMembershipRole(value, fallback = 'viewer') {
  const role = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return LEARNER_MEMBERSHIP_ROLES.includes(role) ? role : fallback;
}

export function canViewParentHub({ platformRole, membershipRole } = {}) {
  return PARENT_HUB_PLATFORM_ROLES.has(normalisePlatformRole(platformRole))
    && READABLE_MEMBERSHIP_ROLES.has(normaliseLearnerMembershipRole(membershipRole));
}

export function canViewAdminHub({ platformRole } = {}) {
  return ADMIN_HUB_PLATFORM_ROLES.has(normalisePlatformRole(platformRole));
}

export function canViewLearnerDiagnostics({ platformRole, membershipRole } = {}) {
  return canViewAdminHub({ platformRole })
    && READABLE_MEMBERSHIP_ROLES.has(normaliseLearnerMembershipRole(membershipRole));
}

export function canMutateLearnerData({ membershipRole } = {}) {
  return WRITABLE_MEMBERSHIP_ROLES.has(normaliseLearnerMembershipRole(membershipRole));
}

export function platformRoleLabel(role) {
  const value = normalisePlatformRole(role);
  if (value === 'admin') return 'Admin';
  if (value === 'ops') return 'Operations';
  return 'Parent';
}

export function learnerMembershipRoleLabel(role) {
  const value = normaliseLearnerMembershipRole(role);
  if (value === 'owner') return 'Owner';
  if (value === 'member') return 'Member';
  return 'Viewer';
}
