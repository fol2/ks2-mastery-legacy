import { WORD_BY_SLUG as DEFAULT_WORD_BY_SLUG } from './data/word-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SECURE_STAGE = 4;

function asTs(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normaliseProgressRecord(rawValue) {
  const raw = isPlainObject(rawValue) ? rawValue : {};
  return {
    stage: Number.isFinite(Number(raw.stage)) ? Number(raw.stage) : 0,
    attempts: Number.isFinite(Number(raw.attempts)) ? Number(raw.attempts) : 0,
    correct: Number.isFinite(Number(raw.correct)) ? Number(raw.correct) : 0,
    wrong: Number.isFinite(Number(raw.wrong)) ? Number(raw.wrong) : 0,
    dueDay: Number.isFinite(Number(raw.dueDay)) ? Number(raw.dueDay) : 0,
    lastDay: Number.isFinite(Number(raw.lastDay)) ? Number(raw.lastDay) : null,
    lastResult: typeof raw.lastResult === 'boolean' ? raw.lastResult : null,
  };
}

function todayDay(nowTs = Date.now()) {
  return Math.floor(asTs(nowTs, Date.now()) / DAY_MS);
}

function accuracyPercent(correct, wrong) {
  const attempts = Math.max(0, Number(correct) || 0) + Math.max(0, Number(wrong) || 0);
  if (!attempts) return null;
  return Math.round((Math.max(0, Number(correct) || 0) / attempts) * 100);
}

function yearLabel(value) {
  return value === '5-6' ? 'Years 5-6' : 'Years 3-4';
}

function familyLabel(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? `${text} family` : 'Mixed spelling families';
}

function runtimeWordMap(runtimeSnapshot) {
  const bySlug = runtimeSnapshot?.wordBySlug && isPlainObject(runtimeSnapshot.wordBySlug)
    ? runtimeSnapshot.wordBySlug
    : DEFAULT_WORD_BY_SLUG;
  const words = Array.isArray(runtimeSnapshot?.words)
    ? runtimeSnapshot.words
    : Object.values(bySlug);
  return {
    words,
    bySlug,
  };
}

function groupBy(items, keyFn) {
  const output = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const current = output.get(key) || [];
    current.push(item);
    output.set(key, current);
  }
  return output;
}

function sortTop(entries, scoreFn, limit = 3) {
  return [...entries]
    .sort((a, b) => {
      const scoreDelta = scoreFn(b) - scoreFn(a);
      if (scoreDelta) return scoreDelta;
      return String(a.label || a.id || '').localeCompare(String(b.label || b.id || ''));
    })
    .slice(0, limit);
}

function sessionLabel(kind) {
  if (kind === 'test') return 'SATs 20';
  if (kind === 'single') return 'Single word';
  if (kind === 'trouble') return 'Trouble drill';
  return 'Smart review';
}

export function buildSpellingLearnerReadModel({
  subjectStateRecord = null,
  practiceSessions = [],
  eventLog = [],
  runtimeSnapshot = null,
  now = Date.now,
} = {}) {
  const nowTs = typeof now === 'function' ? asTs(now(), Date.now()) : asTs(now, Date.now());
  const currentDay = todayDay(nowTs);
  const stateRecord = subjectStateRecord && typeof subjectStateRecord === 'object' && !Array.isArray(subjectStateRecord)
    ? subjectStateRecord
    : {};
  const progressMap = isPlainObject(stateRecord?.data?.progress) ? stateRecord.data.progress : {};
  const prefs = isPlainObject(stateRecord?.data?.prefs) ? stateRecord.data.prefs : {};
  const runtime = runtimeWordMap(runtimeSnapshot);
  const trackedRows = Object.entries(progressMap).map(([slug, entry]) => {
    const progress = normaliseProgressRecord(entry);
    const word = runtime.bySlug[slug] || DEFAULT_WORD_BY_SLUG[slug] || {
      slug,
      word: slug,
      family: '',
      year: '3-4',
      yearLabel: 'Years 3-4',
    };
    const secure = progress.stage >= SECURE_STAGE;
    const due = progress.attempts > 0 && progress.dueDay <= currentDay && !secure;
    const trouble = progress.wrong > progress.correct || (progress.wrong > 0 && !secure) || progress.lastResult === false;
    return {
      slug,
      word: word.word,
      family: word.family || '',
      familyLabel: familyLabel(word.family),
      year: word.year || '3-4',
      yearLabel: word.yearLabel || yearLabel(word.year),
      progress,
      secure,
      due,
      trouble,
      accuracy: accuracyPercent(progress.correct, progress.wrong),
    };
  });

  const secureRows = trackedRows.filter((row) => row.secure);
  const dueRows = trackedRows.filter((row) => row.due);
  const troubleRows = trackedRows.filter((row) => row.trouble);
  const accuracy = accuracyPercent(
    trackedRows.reduce((sum, row) => sum + row.progress.correct, 0),
    trackedRows.reduce((sum, row) => sum + row.progress.wrong, 0),
  );

  const sessionRecords = (Array.isArray(practiceSessions) ? practiceSessions : [])
    .filter((record) => record?.subjectId === 'spelling')
    .sort((a, b) => asTs(b.updatedAt, 0) - asTs(a.updatedAt, 0));
  const activeSession = sessionRecords.find((record) => record?.status === 'active') || null;

  const byFamily = [...groupBy(trackedRows, (row) => row.family || row.year).entries()].map(([id, rows]) => {
    const secureCount = rows.filter((row) => row.secure).length;
    const dueCount = rows.filter((row) => row.due).length;
    const troubleCount = rows.filter((row) => row.trouble).length;
    const averageStage = rows.length
      ? rows.reduce((sum, row) => sum + row.progress.stage, 0) / rows.length
      : 0;
    return {
      id,
      label: rows[0]?.family ? familyLabel(rows[0].family) : yearLabel(rows[0]?.year),
      secureCount,
      dueCount,
      troubleCount,
      averageStage: Number(averageStage.toFixed(2)),
      rows,
    };
  });

  const strengths = sortTop(
    byFamily.filter((entry) => entry.secureCount > 0),
    (entry) => entry.secureCount * 10 + entry.averageStage,
    3,
  ).map((entry) => ({
    subjectId: 'spelling',
    id: entry.id,
    label: entry.label,
    detail: `${entry.secureCount} secure word${entry.secureCount === 1 ? '' : 's'}`,
    secureCount: entry.secureCount,
    dueCount: entry.dueCount,
    troubleCount: entry.troubleCount,
  }));

  const weaknesses = sortTop(
    byFamily.filter((entry) => entry.dueCount > 0 || entry.troubleCount > 0),
    (entry) => entry.troubleCount * 12 + entry.dueCount * 7 - entry.averageStage,
    3,
  ).map((entry) => ({
    subjectId: 'spelling',
    id: entry.id,
    label: entry.label,
    detail: `${entry.dueCount} due · ${entry.troubleCount} trouble`,
    secureCount: entry.secureCount,
    dueCount: entry.dueCount,
    troubleCount: entry.troubleCount,
  }));

  const misconceptionMap = new Map();
  for (const record of sessionRecords) {
    const mistakes = Array.isArray(record?.summary?.mistakes) ? record.summary.mistakes : [];
    for (const mistake of mistakes) {
      const key = `summary:${mistake.family || mistake.year || 'mixed'}`;
      const current = misconceptionMap.get(key) || {
        id: key,
        label: mistake.family ? `${mistake.family} family mistakes` : `${mistake.yearLabel || yearLabel(mistake.year)} mistakes`,
        count: 0,
        lastSeenAt: 0,
        source: 'session-summary',
      };
      current.count += 1;
      current.lastSeenAt = Math.max(current.lastSeenAt, asTs(record.updatedAt, 0));
      misconceptionMap.set(key, current);
    }
  }

  for (const event of Array.isArray(eventLog) ? eventLog : []) {
    if (event?.subjectId !== 'spelling') continue;
    if (event?.type !== 'spelling.retry-cleared') continue;
    const key = `retry:${event.family || event.yearBand || 'mixed'}`;
    const label = event.family
      ? `${event.family} family needed corrections`
      : `${event.yearBand === '5-6' ? 'Years 5-6' : 'Years 3-4'} words needed corrections`;
    const current = misconceptionMap.get(key) || {
      id: key,
      label,
      count: 0,
      lastSeenAt: 0,
      source: 'retry-cleared',
    };
    current.count += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, asTs(event.createdAt, 0));
    misconceptionMap.set(key, current);
  }

  const misconceptionPatterns = [...misconceptionMap.values()]
    .sort((a, b) => (b.count - a.count) || (b.lastSeenAt - a.lastSeenAt))
    .slice(0, 5);

  const recentSessions = sessionRecords.slice(0, 6).map((record) => {
    const summaryCards = Array.isArray(record?.summary?.cards) ? record.summary.cards : [];
    const mistakeCount = Array.isArray(record?.summary?.mistakes) ? record.summary.mistakes.length : 0;
    const scoreCard = summaryCards.find((card) => String(card?.label || '').toLowerCase().includes('correct')) || null;
    return {
      id: record.id,
      subjectId: 'spelling',
      status: record.status,
      sessionKind: record.sessionKind,
      label: record?.summary?.label || sessionLabel(record.sessionKind),
      updatedAt: asTs(record.updatedAt, asTs(record.createdAt, 0)),
      mistakeCount,
      headline: scoreCard?.value != null ? `${scoreCard.value}` : '',
    };
  });

  let currentFocus = {
    subjectId: 'spelling',
    recommendedMode: 'smart',
    label: 'Keep spelling warm with Smart Review',
    detail: secureRows.length
      ? `${secureRows.length} secure words ready for light review.`
      : 'No secure words yet. Start a fresh Smart Review round.',
    dueCount: dueRows.length,
    troubleCount: troubleRows.length,
    activeSessionId: null,
    currentWord: null,
  };

  if (activeSession) {
    const currentSlug = activeSession?.sessionState?.currentSlug || null;
    const currentWord = currentSlug ? (runtime.bySlug[currentSlug]?.word || currentSlug) : null;
    currentFocus = {
      subjectId: 'spelling',
      recommendedMode: activeSession.sessionKind === 'test' ? 'test' : 'smart',
      label: `Continue ${sessionLabel(activeSession.sessionKind)}`,
      detail: currentWord ? `Current word: ${currentWord}.` : 'A live spelling round is saved for this learner.',
      dueCount: dueRows.length,
      troubleCount: troubleRows.length,
      activeSessionId: activeSession.id,
      currentWord,
    };
  } else if (weaknesses.length) {
    currentFocus = {
      subjectId: 'spelling',
      recommendedMode: 'trouble',
      label: 'Run a Trouble Drill next',
      detail: `${weaknesses[0].label} is carrying the heaviest current load.`,
      dueCount: dueRows.length,
      troubleCount: troubleRows.length,
      activeSessionId: null,
      currentWord: null,
    };
  } else if (dueRows.length) {
    currentFocus = {
      subjectId: 'spelling',
      recommendedMode: 'smart',
      label: 'Clear due spelling words',
      detail: `${dueRows.length} word${dueRows.length === 1 ? '' : 's'} are due for spaced review.`,
      dueCount: dueRows.length,
      troubleCount: troubleRows.length,
      activeSessionId: null,
      currentWord: null,
    };
  }

  const lastActivityAt = Math.max(
    ...trackedRows.map((row) => (row.progress.lastDay == null ? 0 : row.progress.lastDay * DAY_MS)),
    ...sessionRecords.map((record) => asTs(record.updatedAt, 0)),
    ...((Array.isArray(eventLog) ? eventLog : []).filter((event) => event?.subjectId === 'spelling').map((event) => asTs(event.createdAt, 0))),
    0,
  );

  return {
    subjectId: 'spelling',
    prefs: {
      mode: typeof prefs.mode === 'string' ? prefs.mode : 'smart',
      yearFilter: typeof prefs.yearFilter === 'string' ? prefs.yearFilter : 'all',
      roundLength: typeof prefs.roundLength === 'string' ? prefs.roundLength : '20',
    },
    currentFocus,
    progressSnapshot: {
      subjectId: 'spelling',
      totalPublishedWords: Array.isArray(runtime.words) ? runtime.words.length : 0,
      trackedWords: trackedRows.length,
      secureWords: secureRows.length,
      dueWords: dueRows.length,
      troubleWords: troubleRows.length,
      accuracyPercent: accuracy,
    },
    overview: {
      trackedWords: trackedRows.length,
      secureWords: secureRows.length,
      dueWords: dueRows.length,
      troubleWords: troubleRows.length,
      accuracyPercent: accuracy,
      lastActivityAt,
    },
    strengths,
    weaknesses,
    misconceptionPatterns,
    recentSessions,
  };
}
