import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createLocalPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { createEventRuntime, createPracticeStreakSubscriber } from '../src/platform/events/index.js';
import { createSpellingRewardSubscriber } from '../src/subjects/spelling/event-hooks.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeTts() {
  return {
    speak() {},
    stop() {},
    warmup() {},
  };
}

function makeHarness({ subscribers = [], nowRef = { value: Date.UTC(2026, 0, 1) }, onError } = {}) {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories, now: () => nowRef.value }),
    now: () => nowRef.value,
    tts: makeTts(),
  });
  const eventRuntime = createEventRuntime({ repositories, subscribers, onError });
  return { repositories, service, eventRuntime, nowRef };
}

function completeSingleWordRound(service, learnerId, answer = 'possess', publish = null) {
  const domainEvents = [];
  let transition = service.startSession(learnerId, {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  });
  if (typeof publish === 'function') publish(transition.events);
  domainEvents.push(...transition.events);

  let state = transition.state;
  while (state.phase === 'session') {
    transition = service.submitAnswer(learnerId, state, answer);
    if (typeof publish === 'function') publish(transition.events);
    domainEvents.push(...transition.events);
    state = transition.state;
    if (state.phase === 'session' && state.awaitingAdvance) {
      transition = service.continueSession(learnerId, state);
      if (typeof publish === 'function') publish(transition.events);
      domainEvents.push(...transition.events);
      state = transition.state;
    }
  }

  return { state, domainEvents };
}

function runSecureWordRounds(harness, rounds = 4, publish = null) {
  const learnerId = 'learner-a';
  let last = null;
  const events = [];

  for (let round = 0; round < rounds; round += 1) {
    const completed = completeSingleWordRound(harness.service, learnerId, 'possess', publish);
    last = completed.state;
    events.push(...completed.domainEvents);
    harness.nowRef.value += DAY_MS * 2;
  }

  return { learnerId, state: last, domainEvents: events };
}

test('reward state updates only when domain events are published through the runtime', () => {
  const harness = makeHarness();
  const { learnerId, domainEvents } = runSecureWordRounds(harness, 4, null);

  assert.deepEqual(harness.repositories.gameState.read(learnerId, 'monster-codex'), {});
  assert.equal(harness.repositories.eventLog.list(learnerId).length, 0);

  const runtime = createEventRuntime({
    repositories: harness.repositories,
    subscribers: [createSpellingRewardSubscriber({ gameStateRepository: harness.repositories.gameState })],
  });
  const published = runtime.publish(domainEvents);

  assert.ok(published.reactionEvents.some((event) => event.kind === 'caught' && event.monsterId === 'inklet'));
  assert.ok(harness.repositories.gameState.read(learnerId, 'monster-codex').inklet.mastered.includes('possess'));
  assert.ok(harness.repositories.eventLog.list(learnerId).some((event) => event.type === 'reward.monster'));
});

test('learning outcomes stay the same with the reward runtime enabled or disabled', () => {
  const disabled = makeHarness({ subscribers: [] });
  const enabled = makeHarness();
  enabled.eventRuntime = createEventRuntime({
    repositories: enabled.repositories,
    subscribers: [
      createPracticeStreakSubscriber(),
      createSpellingRewardSubscriber({ gameStateRepository: enabled.repositories.gameState }),
    ],
  });

  const disabledRun = runSecureWordRounds(disabled, 4, (events) => disabled.eventRuntime.publish(events));
  const enabledRun = runSecureWordRounds(enabled, 4, (events) => enabled.eventRuntime.publish(events));

  assert.deepEqual(
    disabled.service.getStats(disabledRun.learnerId, 'all'),
    enabled.service.getStats(enabledRun.learnerId, 'all'),
  );
  assert.equal(disabledRun.state.phase, 'summary');
  assert.equal(enabledRun.state.phase, 'summary');
  assert.deepEqual(disabled.repositories.gameState.read(disabledRun.learnerId, 'monster-codex'), {});
  assert.ok(enabled.repositories.gameState.read(enabledRun.learnerId, 'monster-codex').inklet.mastered.includes('possess'));
});

test('reward subscriber failures are contained and do not change spelling outcomes', () => {
  const errors = [];
  const baseline = makeHarness({ subscribers: [] });
  const protectedHarness = makeHarness({
    subscribers: [() => { throw new Error('boom'); }],
    onError(error) {
      errors.push(error.message);
    },
  });

  runSecureWordRounds(baseline, 4, (events) => baseline.eventRuntime.publish(events));
  assert.doesNotThrow(() => {
    runSecureWordRounds(protectedHarness, 4, (events) => protectedHarness.eventRuntime.publish(events));
  });

  assert.deepEqual(
    protectedHarness.service.getStats('learner-a', 'all'),
    baseline.service.getStats('learner-a', 'all'),
  );
  assert.deepEqual(protectedHarness.repositories.gameState.read('learner-a', 'monster-codex'), {});
  assert.deepEqual(errors, ['boom', 'boom', 'boom', 'boom', 'boom']);
});

test('practice streak subscriber emits a derived streak-hit event after consecutive session completions', () => {
  const harness = makeHarness({ subscribers: [createPracticeStreakSubscriber()] });

  for (let day = 0; day < 3; day += 1) {
    harness.eventRuntime.publish([
      {
        id: `spelling.session-completed:learner-a:sess-${day}`,
        type: 'spelling.session-completed',
        learnerId: 'learner-a',
        subjectId: 'spelling',
        sessionId: `sess-${day}`,
        mode: 'single',
        createdAt: harness.nowRef.value,
      },
    ]);
    harness.nowRef.value += DAY_MS;
  }

  const events = harness.repositories.eventLog.list('learner-a');
  assert.ok(events.some((event) => event.type === 'platform.practice-streak-hit' && event.streakDays === 3));
});
