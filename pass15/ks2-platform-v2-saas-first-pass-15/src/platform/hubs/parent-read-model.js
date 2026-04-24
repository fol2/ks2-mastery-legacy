import {
  canMutateLearnerData,
  canViewAdminHub,
  canViewParentHub,
  learnerMembershipRoleLabel,
  normaliseLearnerMembershipRole,
  normalisePlatformRole,
  platformRoleLabel,
} from '../access/roles.js';
import { buildSpellingLearnerReadModel } from '../../subjects/spelling/read-model.js';

function asTs(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normaliseAccessibleLearnerEntry(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
  const learner = raw.learner && typeof raw.learner === 'object' && !Array.isArray(raw.learner) ? raw.learner : {};
  const membershipRole = normaliseLearnerMembershipRole(raw.membershipRole || raw.role);
  const writable = canMutateLearnerData({ membershipRole });
  return {
    learnerId: raw.learnerId || learner.id || '',
    learnerName: learner.name || raw.learnerName || 'Learner',
    yearGroup: learner.yearGroup || raw.yearGroup || 'Y5',
    membershipRole,
    membershipRoleLabel: learnerMembershipRoleLabel(membershipRole),
    stateRevision: Number(raw.stateRevision) || 0,
    writable,
    accessModeLabel: writable ? 'Writable learner' : 'Read-only learner',
  };
}

export function buildParentHubReadModel({
  learner,
  platformRole = 'parent',
  membershipRole = 'owner',
  accessibleLearners = [],
  selectedLearnerId = null,
  subjectStates = {},
  practiceSessions = [],
  eventLog = [],
  gameState = {},
  runtimeSnapshots = {},
  now = Date.now,
} = {}) {
  const resolvedPlatformRole = normalisePlatformRole(platformRole);
  const resolvedMembershipRole = normaliseLearnerMembershipRole(membershipRole);
  const canMutate = canMutateLearnerData({ membershipRole: resolvedMembershipRole });
  const spelling = buildSpellingLearnerReadModel({
    subjectStateRecord: isPlainObject(subjectStates.spelling) ? subjectStates.spelling : null,
    practiceSessions,
    eventLog,
    runtimeSnapshot: runtimeSnapshots.spelling || null,
    now,
  });

  const lastActivityAt = Math.max(
    asTs(learner?.createdAt, 0),
    asTs(spelling?.overview?.lastActivityAt, 0),
    ...Object.values(isPlainObject(gameState) ? gameState : {}).map((entry) => asTs(entry?.updatedAt, 0)),
    0,
  );

  const resolvedLearnerId = learner?.id || selectedLearnerId || '';
  const learnerOptions = (Array.isArray(accessibleLearners) ? accessibleLearners : [])
    .map(normaliseAccessibleLearnerEntry)
    .filter((entry) => entry.learnerId);
  const hasSelectedLearnerOption = learnerOptions.some((entry) => entry.learnerId === resolvedLearnerId);
  if (resolvedLearnerId && !hasSelectedLearnerOption) {
    learnerOptions.unshift(normaliseAccessibleLearnerEntry({
      learnerId: resolvedLearnerId,
      membershipRole: resolvedMembershipRole,
      learner,
    }));
  }

  return {
    generatedAt: typeof now === 'function' ? asTs(now(), Date.now()) : asTs(now, Date.now()),
    permissions: {
      platformRole: resolvedPlatformRole,
      platformRoleLabel: platformRoleLabel(resolvedPlatformRole),
      membershipRole: resolvedMembershipRole,
      membershipRoleLabel: learnerMembershipRoleLabel(resolvedMembershipRole),
      canViewParentHub: canViewParentHub({ platformRole: resolvedPlatformRole, membershipRole: resolvedMembershipRole }),
      canViewAdminHub: canViewAdminHub({ platformRole: resolvedPlatformRole }),
      canMutateLearnerData: canMutate,
      accessModeLabel: canMutate ? 'Writable learner' : 'Read-only learner',
    },
    learner: {
      id: learner?.id || '',
      name: learner?.name || 'Learner',
      yearGroup: learner?.yearGroup || 'Y5',
      goal: learner?.goal || 'sats',
      dailyMinutes: Number(learner?.dailyMinutes) || 15,
      lastActivityAt,
      activeSubjectCount: spelling.progressSnapshot.trackedWords > 0 ? 1 : 0,
    },
    learnerOverview: {
      secureWords: spelling.progressSnapshot.secureWords,
      dueWords: spelling.progressSnapshot.dueWords,
      troubleWords: spelling.progressSnapshot.troubleWords,
      accuracyPercent: spelling.progressSnapshot.accuracyPercent,
      recentSessions: spelling.recentSessions.length,
    },
    selectedLearnerId: resolvedLearnerId,
    accessibleLearners: learnerOptions,
    dueWork: [spelling.currentFocus],
    recentSessions: spelling.recentSessions,
    strengths: spelling.strengths,
    weaknesses: spelling.weaknesses,
    misconceptionPatterns: spelling.misconceptionPatterns,
    progressSnapshots: [spelling.progressSnapshot],
    exportEntryPoints: [
      {
        kind: 'learner',
        label: 'Export current learner snapshot',
        action: 'platform-export-learner',
      },
      {
        kind: 'platform',
        label: 'Export full app snapshot',
        action: 'platform-export-app',
      },
    ],
  };
}
