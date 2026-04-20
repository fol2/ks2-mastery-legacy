import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createLocalPlatformRepositories } from '../src/platform/core/repositories/index.js';
import { createStore } from '../src/platform/core/store.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';
import { renderApp } from '../src/platform/ui/render.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';

test('dashboard render smoke test covers spelling subject dashboard stats without crashing', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const store = createStore(SUBJECTS, { repositories });
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
  });

  const appState = store.getState();
  const html = renderApp(appState, {
    appState,
    store,
    repositories,
    services: { spelling: service },
    subject: SUBJECTS[0],
    service,
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
    applySubjectTransition() {
      return true;
    },
  });

  assert.match(html, /Subject registry/);
  assert.match(html, /Spelling/);
});
