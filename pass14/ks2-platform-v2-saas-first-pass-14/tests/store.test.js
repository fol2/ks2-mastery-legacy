import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createStore } from '../src/platform/core/store.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';
import { createLocalPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';

test('shared store creates and selects a new learner', () => {
  installMemoryStorage();
  const store = createStore(SUBJECTS);
  const initial = store.getState();
  const initialCount = initial.learners.allIds.length;

  const learner = store.createLearner({ name: 'Ava', yearGroup: 'Y4' });
  const state = store.getState();

  assert.equal(state.learners.allIds.length, initialCount + 1);
  assert.equal(state.learners.selectedId, learner.id);
  assert.equal(state.learners.byId[learner.id].name, 'Ava');
  assert.equal(state.subjectUi.spelling.phase, 'dashboard');
});

test('shared store can switch subject tabs without losing route context', () => {
  installMemoryStorage();
  const store = createStore(SUBJECTS);

  store.openSubject('spelling');
  store.setTab('analytics');

  const state = store.getState();
  assert.equal(state.route.screen, 'subject');
  assert.equal(state.route.subjectId, 'spelling');
  assert.equal(state.route.tab, 'analytics');
});

test('shared store can route to adult operating surfaces', () => {
  installMemoryStorage();
  const store = createStore(SUBJECTS);

  store.openParentHub();
  assert.equal(store.getState().route.screen, 'parent-hub');

  store.openAdminHub();
  assert.equal(store.getState().route.screen, 'admin-hub');

  store.goHome();
  assert.equal(store.getState().route.screen, 'dashboard');
});

test('serialisable spelling state survives store persistence for resume', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
  });

  const firstStore = createStore(SUBJECTS, { repositories });
  const learnerId = firstStore.getState().learners.selectedId;
  const started = service.startSession(learnerId, {
    mode: 'single',
    words: ['possess'],
    yearFilter: 'all',
    length: 1,
  });

  firstStore.updateSubjectUi('spelling', started.state);
  const restoredStore = createStore(SUBJECTS, { repositories });
  const restoredUi = restoredStore.getState().subjectUi.spelling;
  const resumed = service.initState(restoredUi, learnerId);

  assert.equal(resumed.phase, 'session');
  assert.equal(resumed.session.currentCard.slug, 'possess');
});
