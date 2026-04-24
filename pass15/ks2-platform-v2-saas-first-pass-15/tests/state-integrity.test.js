import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createMockRepositoryServer } from './helpers/mock-api-server.js';
import {
  createApiPlatformRepositories,
  createLocalPlatformRepositories,
  REPO_SCHEMA_VERSION,
  REPO_STORAGE_KEYS,
} from '../src/platform/core/repositories/index.js';
import {
  exportLearnerSnapshot,
  exportPlatformSnapshot,
  importPlatformSnapshot,
} from '../src/platform/core/data-transfer.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';

function makeTts() {
  return {
    speak() {},
    stop() {},
    warmup() {},
  };
}

test('local repositories normalise malformed persisted collections and repair storage metadata', () => {
  const storage = installMemoryStorage();

  storage.setItem(REPO_STORAGE_KEYS.learners, JSON.stringify({
    byId: {
      'learner-a': {
        id: 'learner-a',
        name: 42,
        yearGroup: 'Y9',
        dailyMinutes: '999',
        avatarColor: 'bad',
      },
    },
    allIds: ['learner-a', 'missing'],
    selectedId: 'missing',
  }));
  storage.setItem(REPO_STORAGE_KEYS.subjectStates, JSON.stringify({
    'learner-a::spelling': { ui: 'bad', data: 'bad', updatedAt: 'x' },
    broken: { ui: { phase: 'dashboard' } },
  }));
  storage.setItem(REPO_STORAGE_KEYS.practiceSessions, JSON.stringify([
    {
      id: 'sess-a',
      learnerId: 'learner-a',
      subjectId: 'spelling',
      sessionKind: 'learning',
      status: 'active',
      sessionState: 'bad',
      summary: ['bad'],
      createdAt: '1',
      updatedAt: '2',
    },
    { learnerId: 'learner-a', subjectId: 'spelling' },
  ]));
  storage.setItem(REPO_STORAGE_KEYS.gameState, JSON.stringify({
    'learner-a::monster-codex': 'bad',
    broken: { value: true },
  }));
  storage.setItem(REPO_STORAGE_KEYS.eventLog, JSON.stringify([
    'bad',
    { learnerId: 7, type: 'spelling.word-secured', createdAt: 'x' },
    { learnerId: 'learner-a', type: 'spelling.word-secured', createdAt: 5 },
  ]));

  const repositories = createLocalPlatformRepositories({ storage });
  const learners = repositories.learners.read();
  const subjectState = repositories.subjectStates.read('learner-a', 'spelling');
  const session = repositories.practiceSessions.latest('learner-a', 'spelling');
  const events = repositories.eventLog.list();
  const meta = JSON.parse(storage.getItem(REPO_STORAGE_KEYS.meta));

  assert.equal(learners.selectedId, 'learner-a');
  assert.equal(learners.byId['learner-a'].name, 'Learner');
  assert.equal(learners.byId['learner-a'].yearGroup, 'Y5');
  assert.equal(learners.byId['learner-a'].dailyMinutes, 60);
  assert.equal(learners.byId['learner-a'].avatarColor, '#3E6FA8');
  assert.deepEqual(subjectState, { ui: null, data: {}, updatedAt: 0 });
  assert.equal(session.id, 'sess-a');
  assert.equal(session.sessionState, null);
  assert.equal(session.summary, null);
  assert.deepEqual(repositories.gameState.read('learner-a', 'monster-codex'), {});
  assert.equal(events.length, 2);
  assert.equal(events[0].learnerId, null);
  assert.equal(events[0].createdAt, 0);
  assert.equal(meta.version, REPO_SCHEMA_VERSION);
});

test('api repositories recover safely from malformed bootstrap payloads', async () => {
  const server = createMockRepositoryServer({
    learners: {
      byId: { 'learner-a': { id: 'learner-a', name: null, dailyMinutes: 1 } },
      allIds: ['learner-a'],
      selectedId: 'missing',
    },
    subjectStates: {
      'learner-a::spelling': { ui: ['bad'], data: 9, updatedAt: 'oops' },
    },
    practiceSessions: [
      {
        id: 'sess-a',
        learnerId: 'learner-a',
        subjectId: 'spelling',
        sessionKind: 'learning',
        status: 'mystery',
        sessionState: 'bad',
        summary: 'bad',
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    gameState: {
      'learner-a::monster-codex': 7,
    },
    eventLog: [
      null,
      { learnerId: 'learner-a', type: 'spelling.word-secured', createdAt: '7' },
    ],
  });

  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
  });
  await repositories.hydrate();

  assert.equal(repositories.learners.read().selectedId, 'learner-a');
  assert.equal(repositories.learners.read().byId['learner-a'].name, 'Learner');
  assert.deepEqual(repositories.subjectStates.read('learner-a', 'spelling'), { ui: null, data: {}, updatedAt: 0 });
  assert.equal(repositories.practiceSessions.latest('learner-a', 'spelling').status, 'active');
  assert.equal(repositories.practiceSessions.latest('learner-a', 'spelling').sessionState, null);
  assert.deepEqual(repositories.gameState.read('learner-a', 'monster-codex'), {});
  assert.equal(repositories.eventLog.list('learner-a')[0].createdAt, 7);
});

test('full platform snapshots round-trip with generic subject-state storage intact', () => {
  const sourceStorage = installMemoryStorage();
  const source = createLocalPlatformRepositories({ storage: sourceStorage });
  source.learners.write({
    byId: { 'learner-a': { id: 'learner-a', name: 'Ava', yearGroup: 'Y4', goal: 'confidence', dailyMinutes: 20, avatarColor: '#123456', createdAt: 11 } },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  });
  source.subjectStates.writeRecord('learner-a', 'spelling', {
    ui: { phase: 'summary', error: '' },
    data: { prefs: { mode: 'smart' }, progress: { possess: { stage: 4 } } },
    updatedAt: 123,
  });
  source.practiceSessions.write({
    id: 'sess-a',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'completed',
    sessionState: null,
    summary: { label: 'Spelling round', message: 'Done.' },
    createdAt: 10,
    updatedAt: 20,
  });
  source.gameState.write('learner-a', 'monster-codex', { inklet: { mastered: ['possess'], caught: true } });
  source.eventLog.append({ id: 'event-1', learnerId: 'learner-a', type: 'spelling.word-secured', createdAt: 5 });

  const payload = exportPlatformSnapshot(source);
  const targetStorage = installMemoryStorage();
  const target = createLocalPlatformRepositories({ storage: targetStorage });
  const result = importPlatformSnapshot(target, payload);

  assert.equal(result.kind, 'app');
  assert.equal(target.learners.read().selectedId, 'learner-a');
  assert.deepEqual(target.subjectStates.read('learner-a', 'spelling'), {
    ui: { phase: 'summary', error: '' },
    data: { prefs: { mode: 'smart' }, progress: { possess: { stage: 4 } } },
    updatedAt: 123,
  });
  assert.equal(target.practiceSessions.latest('learner-a', 'spelling').summary.label, 'Spelling round');
  assert.ok(target.gameState.read('learner-a', 'monster-codex').inklet.caught);
  assert.equal(target.eventLog.list('learner-a')[0].id, 'event-1');
});

test('learner snapshot imports remap conflicting learner ids safely', () => {
  const sourceStorage = installMemoryStorage();
  const source = createLocalPlatformRepositories({ storage: sourceStorage });
  source.learners.write({
    byId: { 'learner-a': { id: 'learner-a', name: 'Ava' } },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  });
  source.subjectStates.writeRecord('learner-a', 'spelling', {
    ui: { phase: 'dashboard' },
    data: { prefs: { mode: 'trouble' } },
    updatedAt: 50,
  });
  source.practiceSessions.write({
    id: 'sess-a',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'completed',
    sessionState: null,
    summary: { label: 'Round' },
    createdAt: 1,
    updatedAt: 2,
  });
  source.gameState.write('learner-a', 'monster-codex', { inklet: { mastered: ['possess'], caught: true } });
  source.eventLog.append({ learnerId: 'learner-a', type: 'spelling.word-secured', createdAt: 8 });
  const payload = exportLearnerSnapshot(source, 'learner-a');

  const targetStorage = installMemoryStorage();
  const target = createLocalPlatformRepositories({ storage: targetStorage });
  target.learners.write({
    byId: { 'learner-a': { id: 'learner-a', name: 'Existing' } },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  });

  const result = importPlatformSnapshot(target, payload);

  assert.equal(result.kind, 'learner');
  assert.equal(result.learnerId, 'learner-a-import-1');
  assert.equal(result.renamed, true);
  assert.equal(target.learners.read().selectedId, 'learner-a-import-1');
  assert.equal(target.learners.read().byId['learner-a-import-1'].name, 'Ava');
  assert.equal(target.subjectStates.read('learner-a-import-1', 'spelling').data.prefs.mode, 'trouble');
  assert.ok(target.gameState.read('learner-a-import-1', 'monster-codex').inklet.caught);
  assert.equal(target.eventLog.list('learner-a-import-1')[0].type, 'spelling.word-secured');
});

test('legacy app-state imports normalise old subject-ui shape into generic subject state', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });

  const result = importPlatformSnapshot(repositories, {
    learners: {
      byId: { 'learner-a': { id: 'learner-a', name: 'Ava', yearGroup: 'Y4' } },
      allIds: ['learner-a'],
      selectedId: 'learner-a',
    },
    subjectUi: {
      spelling: { phase: 'session', error: '' },
    },
  });

  assert.equal(result.kind, 'app');
  assert.equal(repositories.learners.read().selectedId, 'learner-a');
  assert.equal(repositories.subjectStates.read('learner-a', 'spelling').ui.phase, 'session');
});

test('legacy one-page spelling progress imports as learner copies without replacing current learners', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  repositories.learners.write({
    byId: {
      'legacy-a': { id: 'legacy-a', name: 'Existing production learner', yearGroup: 'Y6' },
    },
    allIds: ['legacy-a'],
    selectedId: 'legacy-a',
  });

  const result = importPlatformSnapshot(repositories, {
    kind: 'ks2-legacy-spelling-progress',
    version: 1,
    source: 'ks2-spelling-sprint-v1',
    exportedAt: 1776700000000,
    data: {
      version: 2,
      currentProfileId: 'legacy-b',
      profiles: [
        {
          id: 'legacy-a',
          name: 'Child A',
          progress: {
            possess: { stage: 4, attempts: 5, correct: 4, wrong: 1, dueDay: 20455, lastDay: 20450, lastResult: 'correct' },
          },
        },
        {
          id: 'legacy-b',
          name: 'Child B',
          progress: {
            opposite: { stage: 2, attempts: 3, correct: 2, wrong: 1, dueDay: 20457, lastDay: 20454, lastResult: 'wrong' },
          },
        },
      ],
    },
  });

  const learners = repositories.learners.read();
  assert.equal(result.kind, 'legacy-spelling');
  assert.equal(result.importedCount, 2);
  assert.deepEqual(result.learnerIds, ['legacy-a-import-1', 'legacy-b']);
  assert.equal(result.selectedId, 'legacy-b');
  assert.equal(learners.byId['legacy-a'].name, 'Existing production learner');
  assert.equal(learners.byId['legacy-a-import-1'].name, 'Child A');
  assert.equal(learners.byId['legacy-b'].name, 'Child B');
  assert.equal(learners.selectedId, 'legacy-b');
  assert.equal(repositories.subjectStates.read('legacy-a-import-1', 'spelling').data.progress.possess.stage, 4);
  assert.equal(repositories.subjectStates.read('legacy-b', 'spelling').data.progress.opposite.lastResult, 'wrong');
});

test('raw legacy one-page spelling localStorage state can be imported directly', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });

  const result = importPlatformSnapshot(repositories, {
    version: 2,
    currentProfileId: 'child-1',
    profiles: [
      {
        id: 'child-1',
        name: 'Legacy Child',
        progress: {
          accident: { stage: 1, attempts: 1, correct: 1, wrong: 0 },
        },
      },
    ],
  });

  assert.equal(result.kind, 'legacy-spelling');
  assert.equal(result.selectedId, 'child-1');
  assert.equal(repositories.learners.read().byId['child-1'].name, 'Legacy Child');
  assert.equal(repositories.subjectStates.read('child-1', 'spelling').data.progress.accident.stage, 1);
});

test('partial spelling session state restores safely after serialisation loss', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: makeTts(),
  });

  const started = service.startSession('learner-a', {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  }).state;

  const partial = JSON.parse(JSON.stringify(started));
  delete partial.session.queue;
  delete partial.session.status;
  delete partial.session.currentPrompt;
  delete partial.session.currentCard;
  partial.session.currentSlug = 'possess';

  const restored = service.initState(partial, 'learner-a');

  assert.equal(restored.phase, 'session');
  assert.equal(restored.session.currentCard.slug, 'possess');
  assert.equal(Array.isArray(restored.session.queue), true);
  assert.equal(restored.session.status.possess.done, false);
});
