import {
  cloneSerialisable,
  currentRepositoryMeta,
  emptyLearnersSnapshot,
  filterSessions,
  gameStateKey,
  normaliseEventLog,
  normaliseLearnerRecord,
  normaliseLearnersSnapshot,
  normalisePracticeSessionRecord,
  normaliseRepositoryBundle,
  normaliseSubjectStateRecord,
  subjectStateKey,
} from '../../src/platform/core/repositories/helpers.js';
import { uid } from '../../src/platform/core/utils.js';
import {
  canViewAdminHub,
  canViewLearnerDiagnostics,
  canViewParentHub,
  normalisePlatformRole,
} from '../../src/platform/access/roles.js';
import { buildAdminHubReadModel } from '../../src/platform/hubs/admin-read-model.js';
import { buildParentHubReadModel } from '../../src/platform/hubs/parent-read-model.js';
import {
  buildSpellingContentSummary,
  normaliseSpellingContentBundle,
  resolvePublishedSnapshot,
  validateSpellingContentBundle,
} from '../../src/subjects/spelling/content/model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../../src/subjects/spelling/data/content-data.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from './errors.js';
import {
  all,
  batch,
  bindStatement,
  first,
  requireDatabase,
  run,
  scalar,
  sqlPlaceholders,
  withTransaction,
} from './d1.js';

const WRITABLE_MEMBERSHIP_ROLES = new Set(['owner', 'member']);
const MEMBERSHIP_ROLES = new Set(['owner', 'member', 'viewer']);
const MUTATION_POLICY_VERSION = 1;

function safeJsonParse(text, fallback) {
  if (text == null || text === '') return cloneSerialisable(fallback);
  try {
    return JSON.parse(text);
  } catch {
    return cloneSerialisable(fallback);
  }
}

function asTs(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((output, key) => {
        output[key] = stableClone(value[key]);
        return output;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableClone(cloneSerialisable(value)));
}

function mutationPayloadHash(kind, payload) {
  return stableStringify({ kind, payload: cloneSerialisable(payload) });
}

function subjectStateRowToRecord(row) {
  return normaliseSubjectStateRecord({
    ui: safeJsonParse(row.ui_json, null),
    data: safeJsonParse(row.data_json, {}),
    updatedAt: row.updated_at,
  });
}

function learnerRowToRecord(row) {
  return normaliseLearnerRecord({
    id: row.id,
    name: row.name,
    yearGroup: row.year_group,
    avatarColor: row.avatar_color,
    goal: row.goal,
    dailyMinutes: row.daily_minutes,
    createdAt: row.created_at,
  }, row.id);
}

function gameStateRowToRecord(row) {
  return cloneSerialisable(safeJsonParse(row.state_json, {})) || {};
}

function practiceSessionRowToRecord(row) {
  return normalisePracticeSessionRecord({
    id: row.id,
    learnerId: row.learner_id,
    subjectId: row.subject_id,
    sessionKind: row.session_kind,
    status: row.status,
    sessionState: safeJsonParse(row.session_state_json, null),
    summary: safeJsonParse(row.summary_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function contentRowToBundle(row) {
  return normaliseSpellingContentBundle(safeJsonParse(row.content_json, SEEDED_SPELLING_CONTENT_BUNDLE));
}

async function readSubjectContentBundle(db, accountId, subjectId = 'spelling') {
  const row = await first(db, 'SELECT * FROM account_subject_content WHERE account_id = ? AND subject_id = ?', [accountId, subjectId]);
  return row ? contentRowToBundle(row) : cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
}

function eventRowToRecord(row) {
  const parsed = safeJsonParse(row.event_json, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const event = {
    ...parsed,
    id: typeof parsed.id === 'string' && parsed.id ? parsed.id : row.id,
    learnerId: parsed.learnerId || row.learner_id || null,
    subjectId: parsed.subjectId || row.subject_id || null,
    systemId: parsed.systemId || row.system_id || null,
    createdAt: Number.isFinite(Number(parsed.createdAt)) ? Number(parsed.createdAt) : asTs(row.created_at, 0),
  };
  if (typeof event.type !== 'string' || !event.type) {
    event.type = row.event_type || event.kind || 'event';
  }
  return event;
}

function writableRole(role) {
  return WRITABLE_MEMBERSHIP_ROLES.has(role);
}

function normaliseMutationInput(rawValue, scopeType) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const requestId = typeof raw.requestId === 'string' && raw.requestId ? raw.requestId : null;
  const correlationId = typeof raw.correlationId === 'string' && raw.correlationId
    ? raw.correlationId
    : requestId;
  const expectedRevisionKey = scopeType === 'account'
    ? 'expectedAccountRevision'
    : 'expectedLearnerRevision';
  const expectedRevision = Number.isFinite(Number(raw[expectedRevisionKey]))
    ? Number(raw[expectedRevisionKey])
    : null;

  if (!requestId) {
    throw new BadRequestError('Mutation requestId is required for write routes.', {
      code: 'mutation_request_id_required',
      scopeType,
    });
  }

  if (expectedRevision == null) {
    throw new BadRequestError(`Mutation ${expectedRevisionKey} is required for write routes.`, {
      code: 'mutation_revision_required',
      scopeType,
    });
  }

  return {
    requestId,
    correlationId,
    expectedRevision,
    expectedRevisionKey,
  };
}

function buildMutationMeta({
  kind,
  scopeType,
  scopeId,
  requestId,
  correlationId,
  expectedRevision,
  appliedRevision,
  replayed = false,
} = {}) {
  return {
    policyVersion: MUTATION_POLICY_VERSION,
    kind,
    scopeType,
    scopeId,
    requestId,
    correlationId,
    expectedRevision,
    appliedRevision,
    replayed,
  };
}

function staleWriteError({ kind, scopeType, scopeId, requestId, correlationId, expectedRevision, currentRevision }) {
  return new ConflictError('Mutation rejected because this state changed in another tab or device. Retry sync to reload the latest state, then repeat the action.', {
    code: 'stale_write',
    retryable: false,
    kind,
    scopeType,
    scopeId,
    requestId,
    correlationId,
    expectedRevision,
    currentRevision,
  });
}

function idempotencyReuseError({ kind, scopeType, scopeId, requestId, correlationId }) {
  return new ConflictError('The same mutation request id was reused for a different payload.', {
    code: 'idempotency_reuse',
    retryable: false,
    kind,
    scopeType,
    scopeId,
    requestId,
    correlationId,
  });
}

function logMutation(level, event, details = {}) {
  const payload = {
    event,
    ...cloneSerialisable(details),
    at: new Date().toISOString(),
  };
  const fn = globalThis.console?.[level] || globalThis.console?.log;
  if (!fn) return;
  try {
    fn('[ks2-worker]', JSON.stringify(payload));
  } catch {
    fn('[ks2-worker]', payload);
  }
}

async function loadMutationReceipt(db, accountId, requestId) {
  return first(db, `
    SELECT account_id, request_id, scope_type, scope_id, mutation_kind, request_hash, response_json, status_code, correlation_id, applied_at
    FROM mutation_receipts
    WHERE account_id = ? AND request_id = ?
  `, [accountId, requestId]);
}

async function storeMutationReceipt(db, {
  accountId,
  requestId,
  scopeType,
  scopeId,
  mutationKind,
  requestHash,
  response,
  statusCode = 200,
  correlationId = null,
  appliedAt,
}) {
  await run(db, `
    INSERT INTO mutation_receipts (
      account_id,
      request_id,
      scope_type,
      scope_id,
      mutation_kind,
      request_hash,
      response_json,
      status_code,
      correlation_id,
      applied_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    accountId,
    requestId,
    scopeType,
    scopeId,
    mutationKind,
    requestHash,
    JSON.stringify(response),
    statusCode,
    correlationId,
    appliedAt,
  ]);
}

async function ensureAccount(db, session, nowTs) {
  const platformRole = normalisePlatformRole(session?.platformRole);
  await run(db, `
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = COALESCE(excluded.email, adult_accounts.email),
      display_name = COALESCE(excluded.display_name, adult_accounts.display_name),
      platform_role = COALESCE(excluded.platform_role, adult_accounts.platform_role),
      updated_at = excluded.updated_at
  `, [session.accountId, session.email, session.displayName, platformRole, nowTs, nowTs]);

  return first(db, 'SELECT * FROM adult_accounts WHERE id = ?', [session.accountId]);
}

async function listMembershipRows(db, accountId, { writableOnly = false } = {}) {
  const allowedRoles = writableOnly ? ['owner', 'member'] : ['owner', 'member', 'viewer'];
  const rolePlaceholders = sqlPlaceholders(allowedRoles.length);
  return all(db, `
    SELECT
      m.account_id,
      m.learner_id,
      m.role,
      m.sort_index,
      m.created_at AS membership_created_at,
      m.updated_at AS membership_updated_at,
      l.id,
      l.name,
      l.year_group,
      l.avatar_color,
      l.goal,
      l.daily_minutes,
      l.created_at,
      l.updated_at,
      l.state_revision
    FROM account_learner_memberships m
    JOIN learner_profiles l ON l.id = m.learner_id
    WHERE m.account_id = ?
      AND m.role IN (${rolePlaceholders})
    ORDER BY m.sort_index ASC, l.created_at ASC, l.id ASC
  `, [accountId, ...allowedRoles]);
}

async function getMembership(db, accountId, learnerId) {
  return first(db, `
    SELECT account_id, learner_id, role, sort_index, created_at, updated_at
    FROM account_learner_memberships
    WHERE account_id = ? AND learner_id = ?
  `, [accountId, learnerId]);
}

async function requireLearnerWriteAccess(db, accountId, learnerId) {
  const membership = await getMembership(db, accountId, learnerId);
  if (!membership || !writableRole(membership.role)) {
    throw new ForbiddenError('Learner access denied.', {
      learnerId,
      required: 'owner-or-member',
    });
  }
  return membership;
}


async function requireLearnerReadAccess(db, accountId, learnerId) {
  const membership = await getMembership(db, accountId, learnerId);
  if (!membership || !MEMBERSHIP_ROLES.has(membership.role)) {
    throw new ForbiddenError('Learner access denied.', {
      learnerId,
      required: 'owner-member-or-viewer',
    });
  }
  return membership;
}

function membershipRowToModel(row) {
  return {
    learnerId: row?.learner_id || row?.id || '',
    role: row?.role || 'viewer',
    sortIndex: Number(row?.sort_index) || 0,
    stateRevision: Number(row?.state_revision) || 0,
    learner: learnerRowToRecord(row),
  };
}

function accountPlatformRole(account) {
  return normalisePlatformRole(account?.platform_role);
}

function requireParentHubAccess(account, membership) {
  if (!canViewParentHub({ platformRole: accountPlatformRole(account), membershipRole: membership?.role })) {
    throw new ForbiddenError('Parent Hub access denied.', {
      code: 'parent_hub_forbidden',
      required: 'platform-role-parent plus readable learner membership',
      learnerId: membership?.learner_id || null,
    });
  }
}

function requireAdminHubAccess(account) {
  if (!canViewAdminHub({ platformRole: accountPlatformRole(account) })) {
    throw new ForbiddenError('Admin / operations access denied.', {
      code: 'admin_hub_forbidden',
      required: 'platform-role-admin-or-ops',
    });
  }
}

function runtimeSnapshotForBundle(bundle) {
  return resolvePublishedSnapshot(bundle) || resolvePublishedSnapshot(SEEDED_SPELLING_CONTENT_BUNDLE) || null;
}

async function loadLearnerReadBundle(db, learnerId) {
  const subjectRows = await all(db, `
    SELECT learner_id, subject_id, ui_json, data_json, updated_at
    FROM child_subject_state
    WHERE learner_id = ?
  `, [learnerId]);
  const sessionRows = await all(db, `
    SELECT id, learner_id, subject_id, session_kind, status, session_state_json, summary_json, created_at, updated_at
    FROM practice_sessions
    WHERE learner_id = ?
    ORDER BY updated_at DESC, id DESC
  `, [learnerId]);
  const gameRows = await all(db, `
    SELECT learner_id, system_id, state_json, updated_at
    FROM child_game_state
    WHERE learner_id = ?
  `, [learnerId]);
  const eventRows = await all(db, `
    SELECT id, learner_id, subject_id, system_id, event_type, event_json, created_at
    FROM event_log
    WHERE learner_id = ?
    ORDER BY created_at ASC, id ASC
  `, [learnerId]);

  const subjectStates = {};
  subjectRows.forEach((row) => {
    subjectStates[row.subject_id] = subjectStateRowToRecord(row);
  });

  const gameState = {};
  gameRows.forEach((row) => {
    gameState[gameStateKey(row.learner_id, row.system_id)] = gameStateRowToRecord(row);
  });

  return {
    subjectStates,
    practiceSessions: filterSessions(sessionRows.map(practiceSessionRowToRecord), learnerId),
    gameState,
    eventLog: normaliseEventLog(eventRows.map(eventRowToRecord).filter(Boolean)),
  };
}

async function listMutationReceiptRows(db, accountId, { requestId = null, scopeId = null, limit = 20 } = {}) {
  const clauses = ['account_id = ?'];
  const params = [accountId];
  if (typeof requestId === 'string' && requestId) {
    clauses.push('request_id = ?');
    params.push(requestId);
  }
  if (typeof scopeId === 'string' && scopeId) {
    clauses.push('scope_id = ?');
    params.push(scopeId);
  }
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  params.push(safeLimit);
  return all(db, `
    SELECT account_id, request_id, scope_type, scope_id, mutation_kind, status_code, correlation_id, applied_at
    FROM mutation_receipts
    WHERE ${clauses.join(' AND ')}
    ORDER BY applied_at DESC, request_id DESC
    LIMIT ?
  `, params);
}

async function ensureUniqueOrAccessibleLearnerId(db, accountId, learnerId) {
  const membership = await getMembership(db, accountId, learnerId);
  if (membership) return membership;
  const existing = await scalar(db, 'SELECT id FROM learner_profiles WHERE id = ?', [learnerId]);
  if (existing) {
    throw new ForbiddenError('Learner id already exists outside this account scope.', { learnerId });
  }
  return null;
}

async function countOtherOwners(db, learnerId, excludingAccountId) {
  return Number(await scalar(db, `
    SELECT COUNT(*) AS count
    FROM account_learner_memberships
    WHERE learner_id = ?
      AND account_id != ?
      AND role = 'owner'
  `, [learnerId, excludingAccountId], 'count') || 0);
}

async function findPromotionCandidate(db, learnerId, excludingAccountId) {
  return first(db, `
    SELECT account_id, learner_id, role, sort_index, created_at, updated_at
    FROM account_learner_memberships
    WHERE learner_id = ?
      AND account_id != ?
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC, account_id ASC
    LIMIT 1
  `, [learnerId, excludingAccountId]);
}

async function releaseMembershipOrDeleteLearner(db, accountId, learnerId, role, nowTs) {
  if (role !== 'owner') {
    await run(db, 'DELETE FROM account_learner_memberships WHERE account_id = ? AND learner_id = ?', [accountId, learnerId]);
    return 'membership_removed';
  }

  const candidate = await findPromotionCandidate(db, learnerId, accountId);
  if (!candidate) {
    await run(db, 'DELETE FROM learner_profiles WHERE id = ?', [learnerId]);
    return 'learner_deleted';
  }

  const otherOwnerCount = await countOtherOwners(db, learnerId, accountId);
  if (!otherOwnerCount && candidate.role !== 'owner') {
    await run(db, `
      UPDATE account_learner_memberships
      SET role = 'owner', updated_at = ?
      WHERE account_id = ? AND learner_id = ?
    `, [nowTs, candidate.account_id, learnerId]);
  }

  await run(db, 'DELETE FROM account_learner_memberships WHERE account_id = ? AND learner_id = ?', [accountId, learnerId]);
  return 'membership_removed';
}

async function bootstrapBundle(db, accountId) {
  const account = await first(db, 'SELECT * FROM adult_accounts WHERE id = ?', [accountId]);
  const membershipRows = await listMembershipRows(db, accountId, { writableOnly: true });
  const learnersById = {};
  const learnerIds = [];
  const learnerRevisions = {};

  for (const row of membershipRows) {
    const learner = learnerRowToRecord(row);
    if (!learner) continue;
    learnersById[learner.id] = learner;
    learnerIds.push(learner.id);
    learnerRevisions[learner.id] = Number(row.state_revision) || 0;
  }

  const selectedId = learnerIds.includes(account?.selected_learner_id)
    ? account.selected_learner_id
    : (learnerIds[0] || null);

  if (selectedId !== (account?.selected_learner_id || null)) {
    await run(db, 'UPDATE adult_accounts SET selected_learner_id = ?, updated_at = ? WHERE id = ?', [selectedId, Date.now(), accountId]);
  }

  if (!learnerIds.length) {
    return {
      ...normaliseRepositoryBundle({
        meta: currentRepositoryMeta(),
        learners: emptyLearnersSnapshot(),
        subjectStates: {},
        practiceSessions: [],
        gameState: {},
        eventLog: [],
      }),
      syncState: {
        policyVersion: MUTATION_POLICY_VERSION,
        accountRevision: Number(account?.repo_revision) || 0,
        learnerRevisions: {},
      },
    };
  }

  const placeholders = sqlPlaceholders(learnerIds.length);
  const subjectRows = await all(db, `
    SELECT learner_id, subject_id, ui_json, data_json, updated_at
    FROM child_subject_state
    WHERE learner_id IN (${placeholders})
  `, learnerIds);
  const sessionRows = await all(db, `
    SELECT id, learner_id, subject_id, session_kind, status, session_state_json, summary_json, created_at, updated_at
    FROM practice_sessions
    WHERE learner_id IN (${placeholders})
    ORDER BY updated_at DESC, id DESC
  `, learnerIds);
  const gameRows = await all(db, `
    SELECT learner_id, system_id, state_json, updated_at
    FROM child_game_state
    WHERE learner_id IN (${placeholders})
  `, learnerIds);
  const eventRows = await all(db, `
    SELECT id, learner_id, subject_id, system_id, event_type, event_json, created_at
    FROM event_log
    WHERE learner_id IN (${placeholders})
    ORDER BY created_at ASC, id ASC
  `, learnerIds);

  const subjectStates = {};
  subjectRows.forEach((row) => {
    subjectStates[subjectStateKey(row.learner_id, row.subject_id)] = subjectStateRowToRecord(row);
  });

  const gameState = {};
  gameRows.forEach((row) => {
    gameState[gameStateKey(row.learner_id, row.system_id)] = gameStateRowToRecord(row);
  });

  return {
    ...normaliseRepositoryBundle({
      meta: currentRepositoryMeta(),
      learners: {
        byId: learnersById,
        allIds: learnerIds,
        selectedId,
      },
      subjectStates,
      practiceSessions: filterSessions(sessionRows.map(practiceSessionRowToRecord)),
      gameState,
      eventLog: normaliseEventLog(eventRows.map(eventRowToRecord).filter(Boolean)),
    }),
    syncState: {
      policyVersion: MUTATION_POLICY_VERSION,
      accountRevision: Number(account?.repo_revision) || 0,
      learnerRevisions,
    },
  };
}

async function writeLearnersSnapshot(db, accountId, snapshot, nowTs) {
  const next = normaliseLearnersSnapshot(snapshot);
  const currentRows = await listMembershipRows(db, accountId, { writableOnly: true });
  const currentMap = new Map(currentRows.map((row) => [row.id, row]));
  const incomingIds = next.allIds.filter((id) => Boolean(next.byId[id]));
  const statements = [];

  for (const [index, learnerId] of incomingIds.entries()) {
    const learner = next.byId[learnerId];
    if (!learner) continue;
    const existingMembership = currentMap.get(learnerId) || await ensureUniqueOrAccessibleLearnerId(db, accountId, learnerId);
    if (existingMembership) {
      if (!MEMBERSHIP_ROLES.has(existingMembership.role) || !writableRole(existingMembership.role)) {
        throw new ForbiddenError('Learner is not writable in this account scope.', { learnerId });
      }
      statements.push(bindStatement(db, `
        UPDATE learner_profiles
        SET name = ?, year_group = ?, avatar_color = ?, goal = ?, daily_minutes = ?, updated_at = ?
        WHERE id = ?
      `, [
        learner.name,
        learner.yearGroup,
        learner.avatarColor,
        learner.goal,
        learner.dailyMinutes,
        nowTs,
        learner.id,
      ]));
      statements.push(bindStatement(db, `
        UPDATE account_learner_memberships
        SET sort_index = ?, updated_at = ?
        WHERE account_id = ? AND learner_id = ?
      `, [index, nowTs, accountId, learner.id]));
      continue;
    }

    statements.push(bindStatement(db, `
      INSERT INTO learner_profiles (id, name, year_group, avatar_color, goal, daily_minutes, created_at, updated_at, state_revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      learner.id,
      learner.name,
      learner.yearGroup,
      learner.avatarColor,
      learner.goal,
      learner.dailyMinutes,
      nowTs,
      nowTs,
    ]));
    statements.push(bindStatement(db, `
      INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
      VALUES (?, ?, 'owner', ?, ?, ?)
    `, [accountId, learner.id, index, nowTs, nowTs]));
  }

  await batch(db, statements);

  for (const row of currentRows) {
    if (incomingIds.includes(row.id)) continue;
    await releaseMembershipOrDeleteLearner(db, accountId, row.id, row.role, nowTs);
  }

  const selectedId = next.selectedId && incomingIds.includes(next.selectedId)
    ? next.selectedId
    : (incomingIds[0] || null);
  await run(db, 'UPDATE adult_accounts SET selected_learner_id = ?, updated_at = ? WHERE id = ?', [selectedId, nowTs, accountId]);
  return bootstrapBundle(db, accountId);
}

async function withAccountMutation(db, {
  accountId,
  kind,
  payload,
  mutation,
  nowTs,
  apply,
}) {
  const nextMutation = normaliseMutationInput(mutation, 'account');
  const requestHash = mutationPayloadHash(kind, payload);

  return withTransaction(db, async () => {
    const existingReceipt = await loadMutationReceipt(db, accountId, nextMutation.requestId);
    if (existingReceipt) {
      if (existingReceipt.request_hash !== requestHash) {
        throw idempotencyReuseError({
          kind,
          scopeType: 'account',
          scopeId: accountId,
          requestId: nextMutation.requestId,
          correlationId: nextMutation.correlationId,
        });
      }
      const replayed = safeJsonParse(existingReceipt.response_json, {});
      replayed.mutation = buildMutationMeta({
        ...replayed.mutation,
        kind,
        scopeType: 'account',
        scopeId: accountId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        replayed: true,
      });
      logMutation('info', 'mutation.replayed', {
        kind,
        scopeType: 'account',
        scopeId: accountId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
      });
      return replayed;
    }

    const account = await first(db, 'SELECT id, repo_revision FROM adult_accounts WHERE id = ?', [accountId]);
    if (!account) throw new NotFoundError('Account scope was not found.', { accountId });

    const casMeta = await run(db, `
      UPDATE adult_accounts
      SET repo_revision = repo_revision + 1,
          updated_at = ?
      WHERE id = ?
        AND repo_revision = ?
    `, [nowTs, accountId, nextMutation.expectedRevision]);
    const casChanges = Number(casMeta?.meta?.changes) || 0;
    if (casChanges !== 1) {
      const currentRevision = Number(await scalar(db, 'SELECT repo_revision FROM adult_accounts WHERE id = ?', [accountId], 'repo_revision')) || 0;
      throw staleWriteError({
        kind,
        scopeType: 'account',
        scopeId: accountId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        expectedRevision: nextMutation.expectedRevision,
        currentRevision,
      });
    }

    const appliedRevision = nextMutation.expectedRevision + 1;
    const applied = await apply();
    const response = {
      ...applied,
      mutation: buildMutationMeta({
        kind,
        scopeType: 'account',
        scopeId: accountId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        expectedRevision: nextMutation.expectedRevision,
        appliedRevision,
      }),
    };
    await storeMutationReceipt(db, {
      accountId,
      requestId: nextMutation.requestId,
      scopeType: 'account',
      scopeId: accountId,
      mutationKind: kind,
      requestHash,
      response,
      correlationId: nextMutation.correlationId,
      appliedAt: nowTs,
    });
    logMutation('info', 'mutation.applied', {
      kind,
      scopeType: 'account',
      scopeId: accountId,
      requestId: nextMutation.requestId,
      correlationId: nextMutation.correlationId,
      expectedRevision: nextMutation.expectedRevision,
      appliedRevision,
    });
    return response;
  });
}

async function withLearnerMutation(db, {
  accountId,
  learnerId,
  kind,
  payload,
  mutation,
  nowTs,
  apply,
}) {
  if (!(typeof learnerId === 'string' && learnerId)) {
    throw new BadRequestError('Learner id is required for this mutation.', { code: 'learner_id_required', kind });
  }

  const nextMutation = normaliseMutationInput(mutation, 'learner');
  const requestHash = mutationPayloadHash(kind, payload);

  return withTransaction(db, async () => {
    const existingReceipt = await loadMutationReceipt(db, accountId, nextMutation.requestId);
    if (existingReceipt) {
      if (existingReceipt.request_hash !== requestHash) {
        throw idempotencyReuseError({
          kind,
          scopeType: 'learner',
          scopeId: learnerId,
          requestId: nextMutation.requestId,
          correlationId: nextMutation.correlationId,
        });
      }
      const replayed = safeJsonParse(existingReceipt.response_json, {});
      replayed.mutation = buildMutationMeta({
        ...replayed.mutation,
        kind,
        scopeType: 'learner',
        scopeId: learnerId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        replayed: true,
      });
      logMutation('info', 'mutation.replayed', {
        kind,
        scopeType: 'learner',
        scopeId: learnerId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
      });
      return replayed;
    }

    await requireLearnerWriteAccess(db, accountId, learnerId);
    const learner = await first(db, 'SELECT id FROM learner_profiles WHERE id = ?', [learnerId]);
    if (!learner) throw new NotFoundError('Learner was not found.', { learnerId });

    const casMeta = await run(db, `
      UPDATE learner_profiles
      SET state_revision = state_revision + 1,
          updated_at = ?
      WHERE id = ?
        AND state_revision = ?
    `, [nowTs, learnerId, nextMutation.expectedRevision]);
    const casChanges = Number(casMeta?.meta?.changes) || 0;
    if (casChanges !== 1) {
      const currentRevision = Number(await scalar(db, 'SELECT state_revision FROM learner_profiles WHERE id = ?', [learnerId], 'state_revision')) || 0;
      throw staleWriteError({
        kind,
        scopeType: 'learner',
        scopeId: learnerId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        expectedRevision: nextMutation.expectedRevision,
        currentRevision,
      });
    }

    const appliedRevision = nextMutation.expectedRevision + 1;
    const applied = await apply();
    const response = {
      ...applied,
      mutation: buildMutationMeta({
        kind,
        scopeType: 'learner',
        scopeId: learnerId,
        requestId: nextMutation.requestId,
        correlationId: nextMutation.correlationId,
        expectedRevision: nextMutation.expectedRevision,
        appliedRevision,
      }),
    };
    await storeMutationReceipt(db, {
      accountId,
      requestId: nextMutation.requestId,
      scopeType: 'learner',
      scopeId: learnerId,
      mutationKind: kind,
      requestHash,
      response,
      correlationId: nextMutation.correlationId,
      appliedAt: nowTs,
    });
    logMutation('info', 'mutation.applied', {
      kind,
      scopeType: 'learner',
      scopeId: learnerId,
      requestId: nextMutation.requestId,
      correlationId: nextMutation.correlationId,
      expectedRevision: nextMutation.expectedRevision,
      appliedRevision,
    });
    return response;
  });
}

export function createWorkerRepository({ env = {}, now = Date.now } = {}) {
  const db = requireDatabase(env);
  const nowFactory = () => asTs(now(), Date.now());

  return {
    async ensureAccount(session) {
      const nowTs = nowFactory();
      await ensureAccount(db, session, nowTs);
      return first(db, 'SELECT * FROM adult_accounts WHERE id = ?', [session.accountId]);
    },
    async readSession(accountId) {
      return first(db, 'SELECT * FROM adult_accounts WHERE id = ?', [accountId]);
    },
    async bootstrap(accountId) {
      return bootstrapBundle(db, accountId);
    },
    async writeLearners(accountId, snapshot, mutation = {}) {
      const nowTs = nowFactory();
      return withAccountMutation(db, {
        accountId,
        kind: 'learners.write',
        payload: { learners: snapshot },
        mutation,
        nowTs,
        apply: async () => {
          const bundle = await writeLearnersSnapshot(db, accountId, snapshot, nowTs);
          return {
            learners: bundle.learners,
            syncState: bundle.syncState,
          };
        },
      });
    },
    async writeSubjectState(accountId, learnerId, subjectId, record, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: 'child_subject_state.put',
        payload: {
          learnerId,
          subjectId,
          record,
        },
        mutation,
        nowTs,
        apply: async () => {
          const next = normaliseSubjectStateRecord(record);
          const updatedAt = asTs(next.updatedAt, nowTs);
          await run(db, `
            INSERT INTO child_subject_state (learner_id, subject_id, ui_json, data_json, updated_at, updated_by_account_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(learner_id, subject_id) DO UPDATE SET
              ui_json = excluded.ui_json,
              data_json = excluded.data_json,
              updated_at = excluded.updated_at,
              updated_by_account_id = excluded.updated_by_account_id
          `, [
            learnerId,
            subjectId,
            JSON.stringify(next.ui),
            JSON.stringify(next.data),
            updatedAt,
            accountId,
          ]);
          return {
            key: `${learnerId || 'default'}::${subjectId || 'unknown'}`,
            record: next,
          };
        },
      });
    },
    async clearSubjectState(accountId, learnerId, subjectId = null, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: subjectId ? 'child_subject_state.delete' : 'child_subject_state.clear_learner',
        payload: {
          learnerId,
          subjectId: subjectId || null,
        },
        mutation,
        nowTs,
        apply: async () => {
          if (subjectId) {
            await run(db, 'DELETE FROM child_subject_state WHERE learner_id = ? AND subject_id = ?', [learnerId, subjectId]);
            return { key: `${learnerId || 'default'}::${subjectId || 'unknown'}`, cleared: true };
          }
          await run(db, 'DELETE FROM child_subject_state WHERE learner_id = ?', [learnerId]);
          return { learnerId, cleared: true };
        },
      });
    },
    async writePracticeSession(accountId, record, mutation = {}) {
      const nowTs = nowFactory();
      const next = normalisePracticeSessionRecord(record);
      if (!next.id || !next.learnerId || !next.subjectId) {
        throw new BadRequestError('Practice session records require id, learnerId and subjectId.');
      }
      return withLearnerMutation(db, {
        accountId,
        learnerId: next.learnerId,
        kind: 'practice_sessions.put',
        payload: { record: next },
        mutation,
        nowTs,
        apply: async () => {
          const createdAt = asTs(next.createdAt, nowTs);
          const updatedAt = asTs(next.updatedAt, createdAt);
          await run(db, `
            INSERT INTO practice_sessions (
              id,
              learner_id,
              subject_id,
              session_kind,
              status,
              session_state_json,
              summary_json,
              created_at,
              updated_at,
              updated_by_account_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              learner_id = excluded.learner_id,
              subject_id = excluded.subject_id,
              session_kind = excluded.session_kind,
              status = excluded.status,
              session_state_json = excluded.session_state_json,
              summary_json = excluded.summary_json,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              updated_by_account_id = excluded.updated_by_account_id
          `, [
            next.id,
            next.learnerId,
            next.subjectId,
            next.sessionKind,
            next.status,
            next.sessionState == null ? null : JSON.stringify(next.sessionState),
            next.summary == null ? null : JSON.stringify(next.summary),
            createdAt,
            updatedAt,
            accountId,
          ]);
          return { record: next };
        },
      });
    },
    async clearPracticeSessions(accountId, learnerId, subjectId = null, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: subjectId ? 'practice_sessions.delete' : 'practice_sessions.clear_learner',
        payload: {
          learnerId,
          subjectId: subjectId || null,
        },
        mutation,
        nowTs,
        apply: async () => {
          if (subjectId) {
            await run(db, 'DELETE FROM practice_sessions WHERE learner_id = ? AND subject_id = ?', [learnerId, subjectId]);
            return { learnerId, subjectId, cleared: true };
          }
          await run(db, 'DELETE FROM practice_sessions WHERE learner_id = ?', [learnerId]);
          return { learnerId, cleared: true };
        },
      });
    },
    async writeGameState(accountId, learnerId, systemId, state, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: 'child_game_state.put',
        payload: {
          learnerId,
          systemId,
          state,
        },
        mutation,
        nowTs,
        apply: async () => {
          const next = cloneSerialisable(state) || {};
          await run(db, `
            INSERT INTO child_game_state (learner_id, system_id, state_json, updated_at, updated_by_account_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(learner_id, system_id) DO UPDATE SET
              state_json = excluded.state_json,
              updated_at = excluded.updated_at,
              updated_by_account_id = excluded.updated_by_account_id
          `, [learnerId, systemId, JSON.stringify(next), nowTs, accountId]);
          return {
            key: `${learnerId || 'default'}::${systemId || 'unknown'}`,
            state: next,
          };
        },
      });
    },
    async clearGameState(accountId, learnerId, systemId = null, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: systemId ? 'child_game_state.delete' : 'child_game_state.clear_learner',
        payload: {
          learnerId,
          systemId: systemId || null,
        },
        mutation,
        nowTs,
        apply: async () => {
          if (systemId) {
            await run(db, 'DELETE FROM child_game_state WHERE learner_id = ? AND system_id = ?', [learnerId, systemId]);
            return { key: `${learnerId || 'default'}::${systemId || 'unknown'}`, cleared: true };
          }
          await run(db, 'DELETE FROM child_game_state WHERE learner_id = ?', [learnerId]);
          return { learnerId, cleared: true };
        },
      });
    },
    async appendEvent(accountId, event, mutation = {}) {
      const nowTs = nowFactory();
      const next = cloneSerialisable(event) || null;
      if (!next || typeof next !== 'object' || Array.isArray(next)) return { event: null };
      if (!(typeof next.learnerId === 'string' && next.learnerId)) {
        throw new BadRequestError('Event log records currently require learnerId.');
      }
      return withLearnerMutation(db, {
        accountId,
        learnerId: next.learnerId,
        kind: 'event_log.append',
        payload: { event: next },
        mutation,
        nowTs,
        apply: async () => {
          const id = typeof next.id === 'string' && next.id ? next.id : uid('event');
          const createdAt = asTs(next.createdAt, nowTs);
          const eventType = typeof next.type === 'string' && next.type
            ? next.type
            : (typeof next.kind === 'string' && next.kind ? next.kind : 'event');
          next.id = id;
          next.createdAt = createdAt;
          await run(db, `
            INSERT INTO event_log (id, learner_id, subject_id, system_id, event_type, event_json, created_at, actor_account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              learner_id = excluded.learner_id,
              subject_id = excluded.subject_id,
              system_id = excluded.system_id,
              event_type = excluded.event_type,
              event_json = excluded.event_json,
              created_at = excluded.created_at,
              actor_account_id = excluded.actor_account_id
          `, [
            id,
            next.learnerId,
            next.subjectId || null,
            next.systemId || null,
            eventType,
            JSON.stringify(next),
            createdAt,
            accountId,
          ]);
          return { count: next ? 1 : 0, event: next };
        },
      });
    },
    async clearEventLog(accountId, learnerId, mutation = {}) {
      const nowTs = nowFactory();
      return withLearnerMutation(db, {
        accountId,
        learnerId,
        kind: 'event_log.clear_learner',
        payload: { learnerId },
        mutation,
        nowTs,
        apply: async () => {
          await run(db, 'DELETE FROM event_log WHERE learner_id = ?', [learnerId]);
          return { learnerId, cleared: true };
        },
      });
    },
    async readSubjectContent(accountId, subjectId = 'spelling') {
      const account = await first(db, 'SELECT id, repo_revision FROM adult_accounts WHERE id = ?', [accountId]);
      const content = await readSubjectContentBundle(db, accountId, subjectId);
      return {
        subjectId,
        content,
        summary: buildSpellingContentSummary(content),
        mutation: {
          policyVersion: MUTATION_POLICY_VERSION,
          scopeType: 'account',
          scopeId: accountId,
          accountRevision: Number(account?.repo_revision) || 0,
        },
      };
    },
    async writeSubjectContent(accountId, subjectId = 'spelling', rawContent, mutation = {}) {
      const nowTs = nowFactory();
      const content = normaliseSpellingContentBundle(rawContent);
      const validation = validateSpellingContentBundle(content);
      if (!validation.ok) {
        throw new BadRequestError('Spelling content validation failed.', {
          code: 'content_validation_failed',
          validation: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
        });
      }
      return withAccountMutation(db, {
        accountId,
        kind: 'subject_content.put',
        payload: { subjectId, content: validation.bundle },
        mutation,
        nowTs,
        apply: async () => {
          await run(db, `
            INSERT INTO account_subject_content (account_id, subject_id, content_json, updated_at, updated_by_account_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(account_id, subject_id) DO UPDATE SET
              content_json = excluded.content_json,
              updated_at = excluded.updated_at,
              updated_by_account_id = excluded.updated_by_account_id
          `, [
            accountId,
            subjectId,
            JSON.stringify(validation.bundle),
            nowTs,
            accountId,
          ]);
          return {
            subjectId,
            content: validation.bundle,
            summary: buildSpellingContentSummary(validation.bundle),
          };
        },
      });
    },
    async readParentHub(accountId, learnerId) {
      const account = await first(db, 'SELECT id, selected_learner_id, repo_revision, platform_role FROM adult_accounts WHERE id = ?', [accountId]);
      const resolvedLearnerId = learnerId || account?.selected_learner_id || null;
      if (!resolvedLearnerId) {
        throw new NotFoundError('No learner is selected for this parent view.', {
          code: 'parent_hub_missing_learner',
        });
      }
      const membership = await requireLearnerReadAccess(db, accountId, resolvedLearnerId);
      requireParentHubAccess(account, membership);
      const learnerRow = await first(db, `
        SELECT l.id, l.name, l.year_group, l.avatar_color, l.goal, l.daily_minutes, l.created_at, l.updated_at
        FROM learner_profiles l
        WHERE l.id = ?
      `, [resolvedLearnerId]);
      const contentBundle = await readSubjectContentBundle(db, accountId, 'spelling');
      const learnerBundle = await loadLearnerReadBundle(db, resolvedLearnerId);
      const model = buildParentHubReadModel({
        learner: learnerRowToRecord(learnerRow),
        platformRole: accountPlatformRole(account),
        membershipRole: membership.role,
        subjectStates: learnerBundle.subjectStates,
        practiceSessions: learnerBundle.practiceSessions,
        eventLog: learnerBundle.eventLog,
        gameState: learnerBundle.gameState,
        runtimeSnapshots: { spelling: runtimeSnapshotForBundle(contentBundle) },
        now: nowFactory,
      });
      return {
        learnerId: resolvedLearnerId,
        parentHub: model,
      };
    },
    async readAdminHub(accountId, { learnerId = null, requestId = null, auditLimit = 20 } = {}) {
      const account = await first(db, 'SELECT id, selected_learner_id, repo_revision, platform_role FROM adult_accounts WHERE id = ?', [accountId]);
      requireAdminHubAccess(account);
      const memberships = await listMembershipRows(db, accountId, { writableOnly: false });
      const contentBundle = await readSubjectContentBundle(db, accountId, 'spelling');
      const learnerBundles = {};
      for (const row of memberships) {
        learnerBundles[row.id] = await loadLearnerReadBundle(db, row.id);
      }
      const selectedLearnerId = learnerId || account?.selected_learner_id || memberships[0]?.id || null;
      const auditEntries = await listMutationReceiptRows(db, accountId, {
        requestId,
        limit: auditLimit,
      });
      const model = buildAdminHubReadModel({
        account: {
          id: accountId,
          selectedLearnerId,
          repoRevision: Number(account?.repo_revision) || 0,
          platformRole: accountPlatformRole(account),
        },
        platformRole: accountPlatformRole(account),
        spellingContentBundle: contentBundle,
        memberships: memberships.map(membershipRowToModel),
        learnerBundles,
        runtimeSnapshots: { spelling: runtimeSnapshotForBundle(contentBundle) },
        auditEntries: auditEntries.map((row) => ({
          requestId: row.request_id,
          mutationKind: row.mutation_kind,
          scopeType: row.scope_type,
          scopeId: row.scope_id,
          correlationId: row.correlation_id,
          appliedAt: row.applied_at,
          statusCode: row.status_code,
        })),
        auditAvailable: true,
        selectedLearnerId,
        now: nowFactory,
      });
      return {
        adminHub: model,
      };
    },
    async resetAccountScope(accountId, mutation = {}) {
      const nowTs = nowFactory();
      return withAccountMutation(db, {
        accountId,
        kind: 'debug.reset',
        payload: { reset: true },
        mutation,
        nowTs,
        apply: async () => {
          const rows = await listMembershipRows(db, accountId, { writableOnly: false });
          for (const row of rows) {
            await releaseMembershipOrDeleteLearner(db, accountId, row.id, row.role, nowTs);
          }
          await run(db, 'UPDATE adult_accounts SET selected_learner_id = NULL, updated_at = ? WHERE id = ?', [nowTs, accountId]);
          await run(db, 'DELETE FROM account_subject_content WHERE account_id = ?', [accountId]);
          const bundle = await bootstrapBundle(db, accountId);
          return {
            reset: true,
            learners: bundle.learners,
            syncState: bundle.syncState,
          };
        },
      });
    },
    async membership(accountId, learnerId) {
      return getMembership(db, accountId, learnerId);
    },
    async learnerOwnerCount(learnerId) {
      return Number(await scalar(db, `
        SELECT COUNT(*) AS count
        FROM account_learner_memberships
        WHERE learner_id = ? AND role = 'owner'
      `, [learnerId], 'count') || 0);
    },
    async accessibleLearnerIds(accountId, { writableOnly = false } = {}) {
      const rows = await listMembershipRows(db, accountId, { writableOnly });
      return rows.map((row) => row.id);
    },
  };
}
