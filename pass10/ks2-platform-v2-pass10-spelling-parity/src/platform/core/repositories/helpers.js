export const REPO_SCHEMA_VERSION = 2;

export const REPO_STORAGE_KEYS = Object.freeze({
  meta: 'ks2-platform-v2.repo.meta',
  learners: 'ks2-platform-v2.repo.learners',
  subjectStates: 'ks2-platform-v2.repo.child-subject-state',
  practiceSessions: 'ks2-platform-v2.repo.practice-sessions',
  gameState: 'ks2-platform-v2.repo.child-game-state',
  eventLog: 'ks2-platform-v2.repo.event-log',
});

const LEARNER_YEAR_GROUPS = new Set(['Y3', 'Y4', 'Y5', 'Y6']);
const LEARNER_GOALS = new Set(['confidence', 'sats', 'catch-up']);
const PRACTICE_SESSION_STATUSES = new Set(['active', 'completed', 'abandoned']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeColor(value, fallback = '#3E6FA8') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry) : [])];
}

export function cloneSerialisable(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function nowTs(now = Date.now) {
  const value = typeof now === 'function' ? Number(now()) : Number(now);
  return Number.isFinite(value) ? value : Date.now();
}

export function loadCollection(storage, key, fallback) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return cloneSerialisable(fallback);
    return JSON.parse(raw);
  } catch {
    return cloneSerialisable(fallback);
  }
}

export function saveCollection(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch {
    // best-effort local persistence in the reference rebuild.
  }
}

export function removeCollection(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // ignore
  }
}

export function subjectStateKey(learnerId, subjectId) {
  return `${learnerId || 'default'}::${subjectId || 'unknown'}`;
}

export function parseSubjectStateKey(key) {
  if (typeof key !== 'string' || !key.includes('::')) return null;
  const [learnerId, subjectId] = key.split('::');
  if (!learnerId || !subjectId) return null;
  return { learnerId, subjectId };
}

export function gameStateKey(learnerId, systemId) {
  return `${learnerId || 'default'}::${systemId || 'unknown'}`;
}

export function parseGameStateKey(key) {
  if (typeof key !== 'string' || !key.includes('::')) return null;
  const [learnerId, systemId] = key.split('::');
  if (!learnerId || !systemId) return null;
  return { learnerId, systemId };
}

export function practiceSessionKey(record) {
  return `${record?.learnerId || 'default'}::${record?.subjectId || 'unknown'}::${record?.id || 'session'}`;
}

export function emptyRepositoryMeta() {
  return {
    version: REPO_SCHEMA_VERSION,
    migratedAt: 0,
  };
}

export function normaliseRepositoryMeta(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    version: Number.isInteger(Number(raw.version)) && Number(raw.version) > 0 ? Number(raw.version) : 1,
    migratedAt: Number.isFinite(Number(raw.migratedAt)) ? Number(raw.migratedAt) : 0,
  };
}

export function currentRepositoryMeta(now = Date.now) {
  return {
    version: REPO_SCHEMA_VERSION,
    migratedAt: nowTs(now),
  };
}

export function emptyLearnersSnapshot() {
  return {
    byId: {},
    allIds: [],
    selectedId: null,
  };
}

export function normaliseLearnerRecord(rawValue, fallbackId = null) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const id = typeof raw.id === 'string' && raw.id ? raw.id : (typeof fallbackId === 'string' && fallbackId ? fallbackId : null);
  if (!id) return null;

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Learner',
    yearGroup: LEARNER_YEAR_GROUPS.has(raw.yearGroup) ? raw.yearGroup : 'Y5',
    avatarColor: safeColor(raw.avatarColor, '#3E6FA8'),
    goal: LEARNER_GOALS.has(raw.goal) ? raw.goal : 'sats',
    dailyMinutes: Math.max(5, Math.min(60, Number.isFinite(Number(raw.dailyMinutes)) ? Number(raw.dailyMinutes) : 15)),
    weakSubjects: uniqueStrings(raw.weakSubjects),
    createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0,
  };
}

export function normaliseLearnersSnapshot(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const rawById = isPlainObject(raw.byId) ? raw.byId : {};
  const byId = {};

  for (const [id, entry] of Object.entries(rawById)) {
    const learner = normaliseLearnerRecord(entry, id);
    if (!learner) continue;
    byId[learner.id] = learner;
  }

  const orderedIds = uniqueStrings(Array.isArray(raw.allIds) ? raw.allIds : []).filter((id) => Boolean(byId[id]));
  const missingIds = Object.keys(byId).filter((id) => !orderedIds.includes(id));
  const allIds = [...orderedIds, ...missingIds];
  const selectedId = typeof raw.selectedId === 'string' && byId[raw.selectedId]
    ? raw.selectedId
    : (allIds[0] || null);

  return { byId, allIds, selectedId };
}

export function emptySubjectStateRecord() {
  return {
    ui: null,
    data: {},
    updatedAt: 0,
  };
}

export function normaliseSubjectStateRecord(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const ui = isPlainObject(raw.ui) ? cloneSerialisable(raw.ui) : null;
  const data = isPlainObject(raw.data) ? cloneSerialisable(raw.data) : {};
  const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0;
  return { ui, data, updatedAt };
}

export function normaliseSubjectStateCollection(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!parseSubjectStateKey(key)) continue;
    output[key] = normaliseSubjectStateRecord(value);
  }
  return output;
}

export function normalisePracticeSessionRecord(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0;
  const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : createdAt;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : null,
    learnerId: typeof raw.learnerId === 'string' && raw.learnerId ? raw.learnerId : null,
    subjectId: typeof raw.subjectId === 'string' && raw.subjectId ? raw.subjectId : null,
    sessionKind: typeof raw.sessionKind === 'string' && raw.sessionKind ? raw.sessionKind : 'practice',
    status: PRACTICE_SESSION_STATUSES.has(raw.status) ? raw.status : 'active',
    sessionState: isPlainObject(raw.sessionState) ? cloneSerialisable(raw.sessionState) : null,
    summary: isPlainObject(raw.summary) ? cloneSerialisable(raw.summary) : null,
    createdAt,
    updatedAt,
  };
}

export function normalisePracticeSessionsCollection(rawValue) {
  const input = Array.isArray(rawValue)
    ? rawValue
    : (isPlainObject(rawValue) ? Object.values(rawValue) : []);
  const deduped = new Map();

  for (const entry of input) {
    const record = normalisePracticeSessionRecord(entry);
    if (!record.id || !record.learnerId || !record.subjectId) continue;
    const key = practiceSessionKey(record);
    const existing = deduped.get(key);
    if (!existing || existing.updatedAt <= record.updatedAt) deduped.set(key, record);
  }

  return [...deduped.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function normaliseGameStateCollection(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  const output = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!parseGameStateKey(key)) continue;
    output[key] = isPlainObject(value) ? cloneSerialisable(value) : {};
  }
  return output;
}

export function normaliseEventRecord(rawValue) {
  const raw = isPlainObject(rawValue) ? cloneSerialisable(rawValue) : null;
  if (!raw) return null;

  if ('id' in raw && !(typeof raw.id === 'string' && raw.id)) delete raw.id;
  if ('type' in raw && !(typeof raw.type === 'string' && raw.type)) delete raw.type;
  if ('kind' in raw && !(typeof raw.kind === 'string' && raw.kind)) delete raw.kind;
  if ('learnerId' in raw && !(typeof raw.learnerId === 'string' && raw.learnerId)) raw.learnerId = null;
  if ('subjectId' in raw && !(typeof raw.subjectId === 'string' && raw.subjectId)) raw.subjectId = null;
  if ('systemId' in raw && !(typeof raw.systemId === 'string' && raw.systemId)) raw.systemId = null;
  if ('sessionId' in raw && !(typeof raw.sessionId === 'string' && raw.sessionId)) raw.sessionId = null;
  if ('wordSlug' in raw && !(typeof raw.wordSlug === 'string' && raw.wordSlug)) raw.wordSlug = null;
  if ('monsterId' in raw && !(typeof raw.monsterId === 'string' && raw.monsterId)) raw.monsterId = null;
  raw.createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0;
  return raw;
}

export function normaliseEventLog(rawValue) {
  const input = Array.isArray(rawValue)
    ? rawValue
    : (isPlainObject(rawValue) ? Object.values(rawValue) : []);
  return input
    .map(normaliseEventRecord)
    .filter(Boolean)
    .slice(-1000);
}

export function normaliseRepositoryBundle(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    meta: normaliseRepositoryMeta(raw.meta),
    learners: normaliseLearnersSnapshot(raw.learners),
    subjectStates: normaliseSubjectStateCollection(raw.subjectStates),
    practiceSessions: normalisePracticeSessionsCollection(raw.practiceSessions),
    gameState: normaliseGameStateCollection(raw.gameState),
    eventLog: normaliseEventLog(raw.eventLog),
  };
}

export function filterSessions(records, learnerId = null, subjectId = null) {
  return normalisePracticeSessionsCollection(records)
    .filter((record) => (learnerId ? record.learnerId === learnerId : true))
    .filter((record) => (subjectId ? record.subjectId === subjectId : true));
}

export function mergeSubjectUi(record, nextUi, updatedAt = Date.now()) {
  const base = normaliseSubjectStateRecord(record);
  return {
    ...base,
    ui: isPlainObject(nextUi) ? cloneSerialisable(nextUi) : null,
    updatedAt,
  };
}

export function mergeSubjectData(record, nextData, updatedAt = Date.now()) {
  const base = normaliseSubjectStateRecord(record);
  return {
    ...base,
    data: isPlainObject(nextData) ? cloneSerialisable(nextData) : {},
    updatedAt,
  };
}

export function mergeSubjectRecord(record, nextRecord) {
  const base = normaliseSubjectStateRecord(record);
  const incoming = normaliseSubjectStateRecord(nextRecord);
  return {
    ui: incoming.ui ?? base.ui,
    data: incoming.data ?? base.data,
    updatedAt: incoming.updatedAt || base.updatedAt,
  };
}
