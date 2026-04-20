import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/platform/core/store.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';
import {
  createApiPlatformRepositories,
  createLocalPlatformRepositories,
} from '../src/platform/core/repositories/index.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { createEventRuntime, createPracticeStreakSubscriber } from '../src/platform/events/index.js';
import { createSpellingRewardSubscriber } from '../src/subjects/spelling/event-hooks.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { createMockRepositoryServer } from './helpers/mock-api-server.js';

function makeTts() {
  return {
    speak() {},
    stop() {},
    warmup() {},
  };
}

function makeHarness(repositories, nowRef) {
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories, now: () => nowRef.value }),
    now: () => nowRef.value,
    tts: makeTts(),
  });
  const eventRuntime = createEventRuntime({
    repositories,
    subscribers: [
      createPracticeStreakSubscriber(),
      createSpellingRewardSubscriber({ gameStateRepository: repositories.gameState }),
    ],
  });
  const store = createStore(SUBJECTS, { repositories });
  const learnerId = store.getState().learners.selectedId;

  function applyTransition(transition) {
    store.updateSubjectUi('spelling', transition.state);
    const published = eventRuntime.publish(transition.events);
    return published.reactionEvents;
  }

  function completeRound(answer = 'possess') {
    let transition = service.startSession(learnerId, {
      mode: 'single',
      words: ['possess'],
      yearFilter: 'all',
      length: 1,
    });
    applyTransition(transition);
    let state = transition.state;

    while (state.phase === 'session') {
      transition = service.submitAnswer(learnerId, state, answer);
      applyTransition(transition);
      state = transition.state;
      if (state.phase === 'session' && state.awaitingAdvance) {
        transition = service.continueSession(learnerId, state);
        applyTransition(transition);
        state = transition.state;
      }
    }

    return state;
  }

  return {
    service,
    store,
    learnerId,
    completeRound,
  };
}

function assertSpellingPersistenceShape(repositories, learnerId) {
  const subjectRecord = repositories.subjectStates.read(learnerId, 'spelling');
  assert.equal(subjectRecord.ui.phase, 'summary');
  assert.ok(subjectRecord.data.progress.possess);
  assert.equal(typeof subjectRecord.data.progress.possess.stage, 'number');

  const latestSession = repositories.practiceSessions.latest(learnerId, 'spelling');
  assert.equal(latestSession.subjectId, 'spelling');
  assert.equal(latestSession.status, 'completed');
  assert.equal(latestSession.summary.mistakes.length, 0);

  const gameState = repositories.gameState.read(learnerId, 'monster-codex');
  assert.ok(gameState.inklet.mastered.includes('possess'));

  const events = repositories.eventLog.list(learnerId);
  assert.ok(events.some((event) => event.type === 'spelling.word-secured'));
  assert.ok(events.some((event) => event.kind === 'caught' && event.monsterId === 'inklet'));
}

test('local repositories keep subject ui and subject data in one generic subject-state record', async () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  repositories.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  repositories.subjectStates.writeUi('learner-a', 'spelling', { phase: 'dashboard', error: '' });

  const record = repositories.subjectStates.read('learner-a', 'spelling');
  assert.deepEqual(record.ui, { phase: 'dashboard', error: '' });
  assert.deepEqual(record.data, { prefs: { mode: 'smart' } });
});

test('api repositories hydrate and flush the same generic contract against a mocked worker', async () => {
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
  });

  await repositories.hydrate();
  repositories.learners.write({
    byId: { 'learner-a': { id: 'learner-a', name: 'Ava' } },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  });
  repositories.subjectStates.writeData('learner-a', 'spelling', { prefs: { mode: 'smart' } });
  repositories.subjectStates.writeUi('learner-a', 'spelling', { phase: 'dashboard', error: '' });
  repositories.practiceSessions.write({
    id: 'sess-a',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'active',
    sessionState: { id: 'sess-a' },
    summary: null,
    createdAt: 1,
    updatedAt: 1,
  });
  repositories.gameState.write('learner-a', 'monster-codex', { inklet: { mastered: ['possess'], caught: true } });
  repositories.eventLog.append({ learnerId: 'learner-a', type: 'spelling.word-secured' });
  await repositories.flush();

  const freshClient = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
  });
  await freshClient.hydrate();

  assert.equal(freshClient.learners.read().selectedId, 'learner-a');
  assert.deepEqual(freshClient.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });
  assert.equal(freshClient.practiceSessions.latest('learner-a', 'spelling').id, 'sess-a');
  assert.ok(freshClient.gameState.read('learner-a', 'monster-codex').inklet.mastered.includes('possess'));
  assert.equal(freshClient.eventLog.list('learner-a').length, 1);
});

test('the reference spelling flow works unchanged against local repositories', async () => {
  const day = 24 * 60 * 60 * 1000;
  const nowRef = { value: Date.UTC(2026, 0, 1) };
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const harness = makeHarness(repositories, nowRef);

  for (let round = 0; round < 4; round += 1) {
    harness.completeRound();
    nowRef.value += day * 2;
  }

  await repositories.flush();
  const restored = createLocalPlatformRepositories({ storage });
  assertSpellingPersistenceShape(restored, harness.learnerId);
});

test('the same spelling flow works against a mocked remote repository adapter', async () => {
  const day = 24 * 60 * 60 * 1000;
  const nowRef = { value: Date.UTC(2026, 0, 1) };
  const server = createMockRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
  });
  await repositories.hydrate();
  const harness = makeHarness(repositories, nowRef);

  for (let round = 0; round < 4; round += 1) {
    harness.completeRound();
    nowRef.value += day * 2;
  }

  await repositories.flush();
  const restored = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
  });
  await restored.hydrate();
  assertSpellingPersistenceShape(restored, harness.learnerId);
});
