import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createAppHarness } from './helpers/app-harness.js';
import { createManualScheduler } from './helpers/manual-scheduler.js';
import { resolveSpellingShortcut } from '../src/subjects/spelling/shortcuts.js';
import { spellingAutoAdvanceDelay } from '../src/subjects/spelling/auto-advance.js';

function typedFormData(value) {
  const formData = new FormData();
  formData.set('typed', value);
  return formData;
}

test('live spelling card keeps family hidden and restores legacy phase-specific labels', () => {
  const storage = installMemoryStorage();
  const harness = createAppHarness({ storage });
  const learnerId = harness.store.getState().learners.selectedId;

  harness.services.spelling.savePrefs(learnerId, { mode: 'smart', roundLength: '1' });
  harness.dispatch('open-subject', { subjectId: 'spelling' });
  harness.dispatch('spelling-start');

  const startHtml = harness.render();
  assert.doesNotMatch(startHtml, /Family:/);
  assert.match(startHtml, /Family hidden during live recall/);
  assert.match(startHtml, /Submit/);
  assert.match(startHtml, /placeholder="Type the spelling here"/);

  harness.dispatch('spelling-submit-form', { formData: typedFormData('wrong') });
  const retryHtml = harness.render();
  assert.match(retryHtml, /Try again/);
  assert.match(retryHtml, /placeholder="Try once more from memory"/);

  harness.dispatch('spelling-submit-form', { formData: typedFormData('still wrong') });
  const correctionHtml = harness.render();
  assert.match(correctionHtml, /Lock it in/);
  assert.match(correctionHtml, /placeholder="Type the correct spelling once"/);
});

test('SATs spelling card keeps audio-only context and save-and-next wording', () => {
  const storage = installMemoryStorage();
  const harness = createAppHarness({ storage });
  const learnerId = harness.store.getState().learners.selectedId;

  harness.services.spelling.savePrefs(learnerId, { mode: 'test' });
  harness.dispatch('open-subject', { subjectId: 'spelling' });
  harness.dispatch('spelling-start');

  const html = harness.render();
  assert.match(html, /Save and next/);
  assert.match(html, /SATs mode uses audio only\. Press Replay to hear the dictation again\./);
  assert.match(html, /placeholder="Type the spelling and move on"/);
});

test('ending a live spelling session asks before abandoning it', () => {
  const storage = installMemoryStorage();
  const harness = createAppHarness({ storage });
  const learnerId = harness.store.getState().learners.selectedId;
  const originalConfirm = globalThis.confirm;

  try {
    harness.services.spelling.savePrefs(learnerId, { mode: 'smart', roundLength: '1' });
    harness.dispatch('open-subject', { subjectId: 'spelling' });
    harness.dispatch('spelling-start');
    assert.equal(harness.store.getState().subjectUi.spelling.phase, 'session');

    globalThis.confirm = () => false;
    harness.dispatch('spelling-end-early');
    assert.equal(harness.store.getState().subjectUi.spelling.phase, 'session');

    globalThis.confirm = () => true;
    harness.dispatch('spelling-end-early');
    assert.equal(harness.store.getState().subjectUi.spelling.phase, 'dashboard');
  } finally {
    globalThis.confirm = originalConfirm;
  }
});

test('shortcut quick-start keeps the old confirm-before-switching behaviour', () => {
  const storage = installMemoryStorage();
  const harness = createAppHarness({ storage });
  const learnerId = harness.store.getState().learners.selectedId;
  const originalConfirm = globalThis.confirm;

  try {
    harness.services.spelling.savePrefs(learnerId, { mode: 'smart', roundLength: '1' });
    harness.dispatch('open-subject', { subjectId: 'spelling' });
    harness.dispatch('spelling-start');
    const before = structuredClone(harness.store.getState().subjectUi.spelling.session);

    globalThis.confirm = () => false;
    harness.dispatch('spelling-shortcut-start', { mode: 'test' });
    assert.equal(harness.store.getState().subjectUi.spelling.session.id, before.id);
    assert.equal(harness.store.getState().subjectUi.spelling.session.type, 'learning');

    globalThis.confirm = () => true;
    harness.dispatch('spelling-shortcut-start', { mode: 'test' });
    assert.equal(harness.store.getState().subjectUi.spelling.session.type, 'test');
  } finally {
    globalThis.confirm = originalConfirm;
  }
});

test('shortcut resolver matches preserved spelling shortcuts and ignores unrelated typing', () => {
  const appState = {
    route: { subjectId: 'spelling', tab: 'practice' },
    subjectUi: {
      spelling: {
        phase: 'session',
        awaitingAdvance: false,
        session: { type: 'learning', phase: 'question' },
      },
    },
  };

  assert.deepEqual(resolveSpellingShortcut({
    key: 'Escape',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'INPUT', name: 'typed' },
  }, appState), {
    action: 'spelling-replay',
    preventDefault: true,
  });

  assert.deepEqual(resolveSpellingShortcut({
    key: 'Escape',
    shiftKey: true,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'INPUT', name: 'typed' },
  }, appState), {
    action: 'spelling-replay-slow',
    preventDefault: true,
  });

  assert.deepEqual(resolveSpellingShortcut({
    key: 's',
    altKey: true,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'INPUT', name: 'typed' },
  }, appState), {
    action: 'spelling-skip',
    preventDefault: true,
  });

  assert.deepEqual(resolveSpellingShortcut({
    key: '1',
    altKey: true,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'DIV' },
  }, appState), {
    action: 'spelling-shortcut-start',
    data: { mode: 'smart' },
    preventDefault: true,
  });

  assert.equal(resolveSpellingShortcut({
    key: '1',
    altKey: true,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'INPUT', name: 'search' },
  }, appState), null);

  assert.deepEqual(resolveSpellingShortcut({
    key: 'k',
    altKey: true,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'BODY' },
  }, appState), {
    focusSelector: 'input[name="typed"]',
    preventDefault: true,
  });
});

test('legacy auto-advance delay is preserved for learning and SATs saves', () => {
  assert.equal(spellingAutoAdvanceDelay({
    phase: 'session',
    awaitingAdvance: true,
    session: { type: 'learning' },
  }), 500);

  assert.equal(spellingAutoAdvanceDelay({
    phase: 'session',
    awaitingAdvance: true,
    session: { type: 'test' },
  }), 320);
});

test('legacy auto-advance can move a one-word learning round on without a manual continue click', () => {
  const storage = installMemoryStorage();
  const scheduler = createManualScheduler();
  const harness = createAppHarness({ storage, scheduler });
  const learnerId = harness.store.getState().learners.selectedId;

  harness.services.spelling.savePrefs(learnerId, { mode: 'smart', roundLength: '1' });
  harness.dispatch('open-subject', { subjectId: 'spelling' });
  harness.dispatch('spelling-start');

  const firstSlug = harness.store.getState().subjectUi.spelling.session.currentCard.slug;
  const answer = harness.store.getState().subjectUi.spelling.session.currentCard.word.word;
  harness.dispatch('spelling-submit-form', { formData: typedFormData(answer) });

  assert.equal(harness.store.getState().subjectUi.spelling.awaitingAdvance, true);
  assert.equal(scheduler.count(), 1);

  scheduler.flushAll();

  assert.equal(harness.store.getState().subjectUi.spelling.phase, 'session');
  assert.equal(harness.store.getState().subjectUi.spelling.awaitingAdvance, false);
  assert.equal(harness.store.getState().subjectUi.spelling.session.currentCard.slug, firstSlug);
});
