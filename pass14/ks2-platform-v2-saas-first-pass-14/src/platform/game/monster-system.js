import { levelFor, MONSTERS, stageFor } from './monsters.js';

const DEFAULT_SYSTEM_ID = 'monster-codex';

function readGameState(gameStateRepository, learnerId, systemId = DEFAULT_SYSTEM_ID) {
  if (!gameStateRepository) return {};
  return gameStateRepository.read(learnerId, systemId) || {};
}

function writeGameState(gameStateRepository, learnerId, state, systemId = DEFAULT_SYSTEM_ID) {
  if (!gameStateRepository) return state || {};
  return gameStateRepository.write(learnerId, systemId, state || {});
}

function countMastered(state, monsterId) {
  return (state?.[monsterId]?.mastered || []).length;
}

export function monsterIdForSpellingYearBand(yearBand) {
  return yearBand === '5-6' ? 'glimmerbug' : 'inklet';
}

function secureWordsFromAnalytics(analytics) {
  const groups = Array.isArray(analytics?.wordGroups) ? analytics.wordGroups : [];
  const state = {
    inklet: { mastered: [], caught: false },
    glimmerbug: { mastered: [], caught: false },
  };

  for (const group of groups) {
    const words = Array.isArray(group?.words) ? group.words : [];
    for (const word of words) {
      if (!word?.slug) continue;
      const isSecure = word.status === 'secure' || Number(word.progress?.stage) >= 4;
      if (!isSecure) continue;
      const monsterId = monsterIdForSpellingYearBand(word.year);
      if (!state[monsterId].mastered.includes(word.slug)) {
        state[monsterId].mastered.push(word.slug);
      }
    }
  }

  state.inklet.caught = state.inklet.mastered.length > 0;
  state.glimmerbug.caught = state.glimmerbug.mastered.length > 0;
  return state;
}

export function loadMonsterState(learnerId, gameStateRepository) {
  return readGameState(gameStateRepository, learnerId, DEFAULT_SYSTEM_ID);
}

export function saveMonsterState(learnerId, state, gameStateRepository) {
  return writeGameState(gameStateRepository, learnerId, state, DEFAULT_SYSTEM_ID);
}

export function progressForMonster(state, monsterId) {
  if (monsterId === 'phaeton') return derivePhaeton(state);
  const entry = state?.[monsterId] || { mastered: [], caught: false };
  const mastered = Array.isArray(entry.mastered) ? entry.mastered.length : 0;
  return {
    mastered,
    stage: stageFor(mastered),
    level: levelFor(mastered),
    caught: Boolean(entry.caught) || mastered >= 10,
    masteredList: Array.isArray(entry.mastered) ? entry.mastered.slice() : [],
  };
}

export function derivePhaeton(state) {
  const ink = countMastered(state, 'inklet');
  const glim = countMastered(state, 'glimmerbug');
  const combined = ink + glim;
  let stage = 0;
  if (combined >= 200) stage = 4;
  else if (combined >= 145) stage = 3;
  else if (combined >= 95) stage = 2;
  else if (combined >= 25) stage = 1;
  return {
    mastered: combined,
    stage,
    level: Math.min(10, Math.floor(combined / 20)),
    caught: stage >= 1,
    masteredList: [],
  };
}

function eventFromTransition(learnerId, monsterId, previous, next) {
  if (!previous.caught && next.caught) return buildEvent(learnerId, 'caught', monsterId, previous, next);
  if (next.stage > previous.stage) return buildEvent(learnerId, next.stage === 4 ? 'mega' : 'evolve', monsterId, previous, next);
  if (next.level > previous.level) return buildEvent(learnerId, 'levelup', monsterId, previous, next);
  return null;
}

function toastBodyFor(kind) {
  if (kind === 'caught') return 'New creature unlocked.';
  if (kind === 'mega') return 'Maximum evolution reached.';
  if (kind === 'evolve') return 'Creature evolved.';
  return 'Level increased.';
}

function buildEvent(learnerId, kind, monsterId, previous, next) {
  const monster = MONSTERS[monsterId];
  const createdAt = Date.now();
  return {
    id: `reward.monster:${learnerId || 'default'}:${monsterId}:${kind}:${next.stage}:${next.level}`,
    type: 'reward.monster',
    kind,
    learnerId,
    systemId: DEFAULT_SYSTEM_ID,
    monsterId,
    monster,
    previous,
    next,
    createdAt,
    toast: {
      title: monster?.name || 'Reward update',
      body: toastBodyFor(kind),
    },
  };
}

export function recordMonsterMastery(learnerId, monsterId, wordSlug, gameStateRepository) {
  if (monsterId === 'phaeton') return [];
  const before = loadMonsterState(learnerId, gameStateRepository);
  const directEntry = before[monsterId] || { mastered: [], caught: false };
  if (directEntry.mastered.includes(wordSlug)) return [];

  const beforeDirect = progressForMonster(before, monsterId);
  const beforePhaeton = derivePhaeton(before);

  const after = {
    ...before,
    [monsterId]: {
      ...directEntry,
      caught: true,
      mastered: [...directEntry.mastered, wordSlug],
    },
  };

  const afterDirect = progressForMonster(after, monsterId);
  const afterPhaeton = derivePhaeton(after);
  saveMonsterState(learnerId, after, gameStateRepository);

  const events = [];
  const directEvent = eventFromTransition(learnerId, monsterId, beforeDirect, afterDirect);
  if (directEvent) events.push(directEvent);
  const aggregateEvent = eventFromTransition(learnerId, 'phaeton', beforePhaeton, afterPhaeton);
  if (aggregateEvent) events.push(aggregateEvent);
  return events;
}

export function monsterSummary(learnerId, gameStateRepository) {
  const state = loadMonsterState(learnerId, gameStateRepository);
  return ['inklet', 'glimmerbug', 'phaeton'].map((monsterId) => ({
    monster: MONSTERS[monsterId],
    progress: progressForMonster(state, monsterId),
  }));
}

export function monsterSummaryFromSpellingAnalytics(analytics) {
  const state = secureWordsFromAnalytics(analytics);
  return ['inklet', 'glimmerbug', 'phaeton'].map((monsterId) => ({
    monster: MONSTERS[monsterId],
    progress: progressForMonster(state, monsterId),
  }));
}
