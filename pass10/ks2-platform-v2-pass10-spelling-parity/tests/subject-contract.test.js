import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSubjectRegistry } from '../src/platform/core/subject-registry.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { createStore } from '../src/platform/core/store.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { spellingModule } from '../src/subjects/spelling/module.js';

function completeSubjectModule(overrides = {}) {
  return {
    id: 'demo',
    name: 'Demo',
    blurb: 'Demo module',
    initState() {
      return { phase: 'dashboard' };
    },
    getDashboardStats() {
      return { pct: 0, due: 0, streak: 0, nextUp: 'Planned' };
    },
    renderPractice() {
      return '<div>practice</div>';
    },
    renderAnalytics() {
      return '<div>analytics</div>';
    },
    renderProfiles() {
      return '<div>profiles</div>';
    },
    renderSettings() {
      return '<div>settings</div>';
    },
    renderMethod() {
      return '<div>method</div>';
    },
    handleAction() {
      return false;
    },
    ...overrides,
  };
}

test('subject registry rejects modules missing required contract functions', () => {
  const broken = completeSubjectModule();
  delete broken.renderSettings;

  assert.throws(
    () => buildSubjectRegistry([broken]),
    /missing required function "renderSettings\(\)"/i,
  );
});

test('subject registry rejects duplicate subject ids', () => {
  const one = completeSubjectModule({ id: 'shared' });
  const two = completeSubjectModule({ id: 'shared', name: 'Second' });

  assert.throws(
    () => buildSubjectRegistry([one, two]),
    /duplicate id "shared"/i,
  );
});

test('store rejects subject modules whose initState does not return an object', () => {
  installMemoryStorage();
  const broken = completeSubjectModule({
    id: 'broken',
    initState() {
      return null;
    },
  });

  assert.throws(
    () => createStore([broken]),
    /initState\(\) must return an object/i,
  );
});

test('spelling practice dashboard renders without service UI metadata', () => {
  const storage = installMemoryStorage();
  const service = createSpellingService({
    storage,
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
  });
  const learner = {
    id: 'learner-a',
    name: 'Ava',
    yearGroup: 'Y5',
    goal: 'sats',
  };
  const appState = {
    learners: {
      selectedId: learner.id,
      byId: { [learner.id]: learner },
    },
    subjectUi: {
      spelling: spellingModule.initState(),
    },
  };

  const html = spellingModule.renderPractice({
    appState,
    learner,
    subject: spellingModule,
    service,
  });

  assert.match(html, /Practice setup/);
  assert.match(html, /#3E6FA8/i);
});
