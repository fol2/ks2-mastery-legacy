import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createLocalPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { SPELLING_EVENT_TYPES } from '../src/subjects/spelling/events.js';
import { rewardEventsFromSpellingEvents } from '../src/subjects/spelling/event-hooks.js';
import { monsterSummaryFromSpellingAnalytics } from '../src/platform/game/monster-system.js';

function makeSeededRandom(seed = 1) {
  let value = seed >>> 0;
  return function seededRandom() {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makeService({ now, random } = {}) {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const spoken = [];
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories, now }),
    now,
    random,
    tts: {
      speak(payload) {
        spoken.push(payload);
      },
      stop() {},
      warmup() {},
    },
  });
  return { storage, repositories, service, spoken };
}

function continueUntilSummary(service, learnerId, state, answer = 'possess') {
  const events = [];
  let current = state;

  while (current.phase === 'session') {
    const submitted = service.submitAnswer(learnerId, current, answer);
    events.push(...submitted.events);
    current = submitted.state;
    assert.equal(current.awaitingAdvance, true);
    const continued = service.continueSession(learnerId, current);
    events.push(...continued.events);
    current = continued.state;
  }

  return { state: current, events };
}

test('starts a spelling session with an explicit subject-state contract', () => {
  const { service } = makeService();
  const transition = service.startSession('learner-a', { mode: 'smart', yearFilter: 'all', length: 5 });

  assert.equal(transition.ok, true);
  assert.equal(transition.state.version, 1);
  assert.equal(transition.state.phase, 'session');
  assert.equal(transition.state.session.progress.total, 5);
  assert.ok(transition.state.session.currentCard.word.word);
  assert.ok(['learning', 'test'].includes(transition.state.session.type));
});

test('injected randomness makes smart-review session selection reproducible', () => {
  const now = () => Date.UTC(2026, 0, 1);
  const first = makeService({ now, random: makeSeededRandom(42) }).service;
  const second = makeService({ now, random: makeSeededRandom(42) }).service;

  const a = first.startSession('learner-a', { mode: 'smart', yearFilter: 'all', length: 5 }).state.session;
  const b = second.startSession('learner-a', { mode: 'smart', yearFilter: 'all', length: 5 }).state.session;

  assert.deepEqual(a.uniqueWords, b.uniqueWords);
  assert.equal(a.currentCard.slug, b.currentCard.slug);
  assert.equal(a.id, b.id);
});

test('service state survives JSON round-trips and resumes retry/correction flow', () => {
  const { service } = makeService();
  let state = service.startSession('learner-a', {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  state = JSON.parse(JSON.stringify(service.submitAnswer('learner-a', state, 'wrong').state));
  assert.equal(state.session.phase, 'retry');

  state = JSON.parse(JSON.stringify(service.submitAnswer('learner-a', state, 'wrong').state));
  assert.equal(state.session.phase, 'correction');

  state = JSON.parse(JSON.stringify(service.submitAnswer('learner-a', state, 'possess').state));
  assert.equal(state.awaitingAdvance, true);
  assert.deepEqual(state.session.queue, ['possess']);

  state = service.continueSession('learner-a', state).state;
  assert.equal(state.phase, 'session');
  assert.equal(state.session.currentCard.slug, 'possess');
  assert.deepEqual(state.session.queue, []);
});

test('clearing a retry step emits an explicit retry-cleared domain event', () => {
  const { service } = makeService();
  let state = service.startSession('learner-a', {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  state = service.submitAnswer('learner-a', state, 'wrong').state;
  const recovered = service.submitAnswer('learner-a', state, 'possess');

  assert.ok(recovered.events.some((event) => event.type === SPELLING_EVENT_TYPES.RETRY_CLEARED && event.fromPhase === 'retry'));
});

test('first-time correct spellings still require one clean return in the same round', () => {
  const { service } = makeService();
  let state = service.startSession('learner-a', {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  state = service.submitAnswer('learner-a', state, 'possess').state;
  assert.equal(state.awaitingAdvance, true);
  assert.equal(state.session.status.possess.done, false);
  assert.equal(state.session.status.possess.successes, 1);
  assert.deepEqual(state.session.queue, ['possess']);

  state = service.continueSession('learner-a', state).state;
  assert.equal(state.phase, 'session');
  assert.equal(state.session.currentCard.slug, 'possess');

  state = service.submitAnswer('learner-a', state, 'possess').state;
  assert.equal(state.awaitingAdvance, true);
  assert.equal(state.session.status.possess.done, true);
  assert.equal(state.session.status.possess.applied, true);

  state = service.continueSession('learner-a', state).state;
  assert.equal(state.phase, 'summary');

  const stats = service.getStats('learner-a', 'all');
  assert.equal(stats.attempts, 1);
  assert.equal(stats.correct, 1);
  assert.equal(stats.accuracy, 100);
});

test('empty submission is rejected without mutating learner progress', () => {
  const { service } = makeService();
  let state = service.startSession('learner-a', {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  const submitted = service.submitAnswer('learner-a', state, '   ');
  state = submitted.state;

  assert.equal(state.feedback.headline, 'Type an answer first.');
  assert.equal(state.awaitingAdvance, false);
  assert.equal(service.getStats('learner-a', 'all').attempts, 0);
});

test('duplicate submission while awaiting advance is ignored', () => {
  const { service } = makeService();
  let state = service.startSession('learner-a', {
    mode: 'test',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  state = service.submitAnswer('learner-a', state, 'possess').state;
  assert.equal(state.awaitingAdvance, true);
  const statsAfterFirst = service.getStats('learner-a', 'all');
  assert.equal(statsAfterFirst.attempts, 1);
  assert.equal(state.session.results.length, 1);

  const duplicate = service.submitAnswer('learner-a', state, 'wrong');
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state.session.results.length, 1);
  assert.deepEqual(service.getStats('learner-a', 'all'), statsAfterFirst);
});

test('repeated successful reviews emit secure-word, mastery-milestone and session-completed events', () => {
  const day = 24 * 60 * 60 * 1000;
  let nowValue = Date.UTC(2026, 0, 1);
  const { service } = makeService({ now: () => nowValue });
  let emittedEvents = [];

  for (let round = 0; round < 4; round += 1) {
    const started = service.startSession('learner-a', {
      mode: 'single',
      words: ['possess'],
      yearFilter: 'all',
      length: 1,
    }).state;
    const completed = continueUntilSummary(service, 'learner-a', started, 'possess');
    emittedEvents = emittedEvents.concat(completed.events);
    nowValue += day * 2;
  }

  const stats = service.getStats('learner-a', 'all');
  assert.equal(stats.secure, 1);
  assert.equal(stats.attempts, 4);
  assert.equal(stats.correct, 4);
  assert.equal(stats.accuracy, 100);
  assert.equal(emittedEvents.filter((event) => event.type === SPELLING_EVENT_TYPES.WORD_SECURED).length, 1);
  assert.equal(emittedEvents.filter((event) => event.type === SPELLING_EVENT_TYPES.MASTERY_MILESTONE).length, 1);
  assert.equal(emittedEvents.filter((event) => event.type === SPELLING_EVENT_TYPES.SESSION_COMPLETED).length, 4);
});

test('reward hook converts spelling secure-word events into platform monster events', () => {
  const day = 24 * 60 * 60 * 1000;
  let nowValue = Date.UTC(2026, 0, 1);
  const { service, repositories } = makeService({ now: () => nowValue });
  let domainEvents = [];

  for (let round = 0; round < 4; round += 1) {
    const started = service.startSession('learner-a', {
      mode: 'single',
      words: ['possess'],
      yearFilter: 'all',
      length: 1,
    }).state;
    const completed = continueUntilSummary(service, 'learner-a', started, 'possess');
    domainEvents = domainEvents.concat(completed.events);
    nowValue += day * 2;
  }

  const rewardEvents = rewardEventsFromSpellingEvents(domainEvents, { gameStateRepository: repositories.gameState });
  assert.ok(rewardEvents.some((event) => event.kind === 'caught' && event.monsterId === 'inklet'));
});

test('codex projection follows secure spelling progress even without reward game state', () => {
  const { service, repositories } = makeService();
  repositories.subjectStates.writeData('learner-a', 'spelling', {
    progress: {
      possess: { stage: 4, attempts: 4, correct: 4, wrong: 0 },
      accommodate: { stage: 4, attempts: 4, correct: 4, wrong: 0 },
    },
  });

  assert.deepEqual(repositories.gameState.read('learner-a', 'monster-codex'), {});

  const summary = monsterSummaryFromSpellingAnalytics(service.getAnalyticsSnapshot('learner-a'));
  const inklet = summary.find((entry) => entry.monster.id === 'inklet');
  const glimmerbug = summary.find((entry) => entry.monster.id === 'glimmerbug');
  const phaeton = summary.find((entry) => entry.monster.id === 'phaeton');

  assert.equal(inklet.progress.mastered, 1);
  assert.deepEqual(inklet.progress.masteredList, ['possess']);
  assert.equal(glimmerbug.progress.mastered, 1);
  assert.deepEqual(glimmerbug.progress.masteredList, ['accommodate']);
  assert.equal(phaeton.progress.mastered, 2);
});

test('analytics snapshot is explicit and normalised', () => {
  const { service } = makeService();
  const snapshot = service.getAnalyticsSnapshot('learner-a');

  assert.equal(snapshot.version, 1);
  assert.ok(Number.isFinite(snapshot.generatedAt));
  assert.deepEqual(Object.keys(snapshot.pools), ['all', 'y34', 'y56']);
  assert.equal(snapshot.pools.all.total > 0, true);
  assert.equal(snapshot.pools.all.accuracy, null);
  assert.deepEqual(snapshot.wordGroups.map((group) => group.key), ['y3-4', 'y5-6']);
  assert.equal(snapshot.wordGroups[0].title, 'Years 3-4');
  const possess = snapshot.wordGroups.flatMap((group) => group.words).find((word) => word.slug === 'possess');
  assert.ok(possess);
  assert.equal(possess.word, 'possess');
  assert.equal(possess.family, 'possess(ion)');
  assert.equal(possess.status, 'new');
  assert.equal(possess.progress.stage, 0);
  assert.equal(possess.stageLabel, 'New / due today');
});

test('malformed persisted session state falls back safely instead of crashing', () => {
  const { service } = makeService();
  const restored = service.initState({
    phase: 'session',
    session: {
      id: 'broken',
      type: 'learning',
      mode: 'single',
      queue: ['missing-word'],
    },
  }, 'learner-a');

  assert.equal(restored.phase, 'dashboard');
  assert.match(restored.error, /could not|missing|valid words/i);
});
