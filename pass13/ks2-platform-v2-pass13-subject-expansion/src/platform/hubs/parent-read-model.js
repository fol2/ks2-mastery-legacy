import {
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

export function buildParentHubReadModel({
  learner,
  platformRole = 'parent',
  membershipRole = 'owner',
  subjectStates = {},
  practiceSessions = [],
  eventLog = [],
  gameState = {},
  runtimeSnapshots = {},
  now = Date.now,
} = {}) {
  const resolvedPlatformRole = normalisePlatformRole(platformRole);
  const resolvedMembershipRole = normaliseLearnerMembershipRole(membershipRole);
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

  return {
    generatedAt: typeof now === 'function' ? asTs(now(), Date.now()) : asTs(now, Date.now()),
    permissions: {
      platformRole: resolvedPlatformRole,
      platformRoleLabel: platformRoleLabel(resolvedPlatformRole),
      membershipRole: resolvedMembershipRole,
      membershipRoleLabel: learnerMembershipRoleLabel(resolvedMembershipRole),
      canViewParentHub: canViewParentHub({ platformRole: resolvedPlatformRole, membershipRole: resolvedMembershipRole }),
      canViewAdminHub: canViewAdminHub({ platformRole: resolvedPlatformRole }),
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
