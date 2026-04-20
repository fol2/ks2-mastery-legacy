import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/platform/core/store.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';
import { createApiPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { createEventRuntime, createPracticeStreakSubscriber } from '../src/platform/events/index.js';
import { createSpellingRewardSubscriber } from '../src/subjects/spelling/event-hooks.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

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
    eventRuntime.publish(transition.events);
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

test('worker session route exposes the development session stub and account scope', async () => {
  const server = createWorkerRepositoryServer();
  const response = await server.fetch('https://repo.test/api/session');
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.auth.mode, 'development-stub');
  assert.equal(payload.session.accountId, 'adult-a');
  assert.equal(payload.learnerCount, 0);

  server.close();
});

test('api repositories match the generic contract against the real D1-backed worker', async () => {
  const server = createWorkerRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });

  await repositories.hydrate();
  repositories.learners.write({
    byId: {
      'learner-a': {
        id: 'learner-a',
        name: 'Ava',
        yearGroup: 'Y5',
        goal: 'sats',
        dailyMinutes: 15,
        avatarColor: '#3E6FA8',
        createdAt: 1,
      },
    },
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
  repositories.eventLog.append({ learnerId: 'learner-a', type: 'spelling.word-secured', createdAt: 5 });
  await repositories.flush();

  const freshClient = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
  });
  await freshClient.hydrate();

  assert.equal(freshClient.learners.read().selectedId, 'learner-a');
  assert.deepEqual(freshClient.subjectStates.read('learner-a', 'spelling').data, { prefs: { mode: 'smart' } });
  assert.equal(freshClient.practiceSessions.latest('learner-a', 'spelling').id, 'sess-a');
  assert.ok(freshClient.gameState.read('learner-a', 'monster-codex').inklet.mastered.includes('possess'));
  assert.equal(freshClient.eventLog.list('learner-a').length, 1);

  server.close();
});

test('the reference spelling flow works unchanged against the real worker backend', async () => {
  const day = 24 * 60 * 60 * 1000;
  const nowRef = { value: Date.UTC(2026, 0, 1) };
  const server = createWorkerRepositoryServer();
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-a'),
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
    authSession: server.authSessionFor('adult-a'),
  });
  await restored.hydrate();
  assertSpellingPersistenceShape(restored, harness.learnerId);

  server.close();
});
