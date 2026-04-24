import {
  canManageAccountRoles,
  canMutateLearnerData,
  canViewAdminHub,
  canViewParentHub,
  canViewLearnerDiagnostics,
  learnerMembershipRoleLabel,
  normaliseLearnerMembershipRole,
  normalisePlatformRole,
  platformRoleLabel,
} from '../access/roles.js';
import { buildSpellingContentSummary, validateSpellingContentBundle } from '../../subjects/spelling/content/model.js';
import { buildParentHubReadModel } from './parent-read-model.js';

function asTs(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function normaliseAuditEntry(rawValue) {
  const raw = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
  return {
    requestId: typeof raw.requestId === 'string' ? raw.requestId : '',
    mutationKind: typeof raw.mutationKind === 'string' ? raw.mutationKind : '',
    scopeType: typeof raw.scopeType === 'string' ? raw.scopeType : '',
    scopeId: typeof raw.scopeId === 'string' ? raw.scopeId : '',
    correlationId: typeof raw.correlationId === 'string' ? raw.correlationId : '',
    appliedAt: asTs(raw.appliedAt, 0),
    statusCode: Number(raw.statusCode) || 0,
  };
}

export function buildAdminHubReadModel({
  account = null,
  platformRole = 'parent',
  spellingContentBundle = null,
  memberships = [],
  learnerBundles = {},
  runtimeSnapshots = {},
  auditEntries = [],
  auditAvailable = false,
  selectedLearnerId = null,
  now = Date.now,
} = {}) {
  const resolvedPlatformRole = normalisePlatformRole(platformRole || account?.platformRole);
  const validation = validateSpellingContentBundle(spellingContentBundle);
  const contentSummary = buildSpellingContentSummary(validation.bundle);
  const generatedAt = typeof now === 'function' ? asTs(now(), Date.now()) : asTs(now, Date.now());
  const diagnosticsEntries = (Array.isArray(memberships) ? memberships : []).map((membership) => {
    const resolvedMembershipRole = normaliseLearnerMembershipRole(membership?.role);
    const learner = membership?.learner || null;
    const learnerId = learner?.id || membership?.learnerId || '';
    const writable = canMutateLearnerData({ membershipRole: resolvedMembershipRole });
    const parentHub = buildParentHubReadModel({
      learner,
      platformRole: 'parent',
      membershipRole: resolvedMembershipRole,
      subjectStates: learnerBundles[learnerId]?.subjectStates || {},
      practiceSessions: learnerBundles[learnerId]?.practiceSessions || [],
      eventLog: learnerBundles[learnerId]?.eventLog || [],
      gameState: learnerBundles[learnerId]?.gameState || {},
      runtimeSnapshots,
      now,
    });
    return {
      learnerId,
      learnerName: learner?.name || 'Learner',
      yearGroup: learner?.yearGroup || 'Y5',
      membershipRole: resolvedMembershipRole,
      membershipRoleLabel: learnerMembershipRoleLabel(resolvedMembershipRole),
      stateRevision: Number(membership?.stateRevision) || 0,
      canViewDiagnostics: canViewLearnerDiagnostics({ platformRole: resolvedPlatformRole, membershipRole: resolvedMembershipRole }),
      writable,
      accessModeLabel: writable ? 'Writable learner' : 'Read-only learner',
      overview: parentHub.learnerOverview,
      currentFocus: parentHub.dueWork[0] || null,
    };
  });

  const selectedDiagnostics = diagnosticsEntries.find((entry) => entry.learnerId === selectedLearnerId)
    || diagnosticsEntries[0]
    || null;
  const canOpenParentHub = canViewParentHub({
    platformRole: resolvedPlatformRole,
    membershipRole: selectedDiagnostics?.membershipRole || 'viewer',
  });

  return {
    generatedAt,
    permissions: {
      platformRole: resolvedPlatformRole,
      platformRoleLabel: platformRoleLabel(resolvedPlatformRole),
      canViewAdminHub: canViewAdminHub({ platformRole: resolvedPlatformRole }),
      canViewParentHub: canOpenParentHub,
      canManageAccountRoles: canManageAccountRoles({ platformRole: resolvedPlatformRole }),
    },
    account: {
      id: account?.id || 'local-browser',
      selectedLearnerId: selectedLearnerId || account?.selectedLearnerId || '',
      repoRevision: Number(account?.repoRevision) || 0,
    },
    contentReleaseStatus: {
      subjectId: 'spelling',
      publishedReleaseId: contentSummary.publishedReleaseId,
      publishedVersion: contentSummary.publishedVersion,
      publishedAt: contentSummary.publishedAt,
      releaseCount: Number(contentSummary.releaseCount) || 0,
      runtimeWordCount: Number(contentSummary.runtimeWordCount) || 0,
      runtimeSentenceCount: Number(contentSummary.runtimeSentenceCount) || 0,
      currentDraftId: validation.bundle.draft.id,
      currentDraftVersion: validation.bundle.draft.version,
      currentDraftState: validation.bundle.draft.state,
      draftUpdatedAt: validation.bundle.draft.updatedAt,
    },
    importValidationStatus: {
      ok: validation.ok,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      importedAt: validation.bundle.draft.provenance?.importedAt || 0,
      source: validation.bundle.draft.provenance?.source || '',
      errors: validation.errors.slice(0, 5),
      warnings: validation.warnings.slice(0, 5),
    },
    auditLogLookup: {
      available: Boolean(auditAvailable),
      entries: (Array.isArray(auditEntries) ? auditEntries : []).map(normaliseAuditEntry),
      note: auditAvailable
        ? 'Backed by durable mutation receipts on the Worker path.'
        : 'Local reference build does not have the Worker audit stream enabled yet.',
    },
    learnerSupport: {
      diagnosticsCount: diagnosticsEntries.length,
      selectedLearnerId: selectedDiagnostics?.learnerId || '',
      accessibleLearners: diagnosticsEntries,
      selectedDiagnostics,
      entryPoints: [
        ...(canOpenParentHub ? [{
          label: 'Open Parent Hub',
          action: 'open-parent-hub',
        }] : []),
        {
          label: 'Open Spelling analytics',
          action: 'open-subject',
          subjectId: 'spelling',
          tab: 'analytics',
        },
        {
          label: 'Export current learner snapshot',
          action: 'platform-export-learner',
        },
      ],
    },
    reality: {
      contentReleaseStatus: 'real',
      importValidationStatus: 'real',
      auditLogLookup: auditAvailable ? 'real' : 'placeholder',
      learnerSupport: 'real',
    },
  };
}
