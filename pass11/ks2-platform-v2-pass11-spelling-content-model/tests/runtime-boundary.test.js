import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import { createAppHarness } from './helpers/app-harness.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';

function makeBrokenSubject({
  id = 'broken-subject',
  name = 'Broken Subject',
  throwInDashboardStats = false,
  throwInPractice = false,
  throwInAction = false,
} = {}) {
  return {
    id,
    name,
    blurb: 'Deliberately broken for runtime-boundary tests.',
    accent: '#8B5CF6',
    accentSoft: '#F3E8FF',
    icon: 'quote',
    available: true,
    initState() {
      return { phase: 'dashboard', error: '' };
    },
    getDashboardStats() {
      if (throwInDashboardStats) throw new Error('dashboard stats exploded');
      return { pct: 0, due: 0, streak: 0, nextUp: 'Broken fixture' };
    },
    renderPractice() {
      if (throwInPractice) throw new Error('renderPractice exploded');
      return '<section class="card"><button class="btn" data-action="broken-action-trigger">Trigger broken action</button></section>';
    },
    renderAnalytics() {
      return '<section class="card">Broken analytics</section>';
    },
    renderProfiles() {
      return '<section class="card">Broken profiles</section>';
    },
    renderSettings() {
      return '<section class="card">Broken settings</section>';
    },
    renderMethod() {
      return '<section class="card">Broken method</section>';
    },
    handleAction(action) {
      if (throwInAction && action === 'broken-action-trigger') {
        throw new Error('handleAction exploded');
      }
      return false;
    },
  };
}

test('dashboard render survives a broken subject dashboard-stats getter', () => {
  const storage = installMemoryStorage();
  const brokenSubject = makeBrokenSubject({ throwInDashboardStats: true });
  const harness = createAppHarness({ storage, subjects: [...SUBJECTS, brokenSubject] });

  const html = harness.render();

  assert.match(html, /Subject registry/);
  assert.match(html, /Spelling/);
  assert.match(html, /Temporarily unavailable/);
  assert.equal(harness.runtimeBoundary.list().some((entry) => entry.subjectId === brokenSubject.id && entry.phase === 'dashboard-stats'), true);
});

test('subject render failures are contained to the active tab instead of breaking the shell', () => {
  const storage = installMemoryStorage();
  const brokenSubject = makeBrokenSubject({ id: 'broken-render', name: 'Broken Render', throwInPractice: true });
  const harness = createAppHarness({ storage, subjects: [...SUBJECTS, brokenSubject] });

  harness.dispatch('open-subject', { subjectId: brokenSubject.id });
  const html = harness.render();

  assert.equal(harness.store.getState().route.subjectId, brokenSubject.id);
  assert.match(html, /Practice temporarily unavailable/);
  assert.match(html, /Try this tab again/);
  assert.match(html, /Current learner/);
  assert.equal(harness.runtimeBoundary.read({
    learnerId: harness.store.getState().learners.selectedId,
    subjectId: brokenSubject.id,
    tab: 'practice',
  }).methodName, 'renderPractice');
});

test('subject action failures are contained and leave routing, toasts, learner switching and spelling state intact', () => {
  const storage = installMemoryStorage();
  const brokenSubject = makeBrokenSubject({ id: 'broken-action', name: 'Broken Action', throwInAction: true });
  const harness = createAppHarness({ storage, subjects: [...SUBJECTS, brokenSubject] });

  const learnerA = harness.store.getState().learners.selectedId;
  harness.services.spelling.savePrefs(learnerA, { roundLength: '1' });
  const started = harness.services.spelling.startSession(learnerA, {
    mode: 'smart',
    yearFilter: 'all',
    length: 1,
  });
  harness.store.updateSubjectUi('spelling', started.state);
  const spellingBefore = structuredClone(harness.store.getState().subjectUi.spelling);
  const spellingBeforeJson = JSON.stringify(spellingBefore);
  harness.store.pushToasts({ toast: { title: 'Existing toast', body: 'Still here' } });

  harness.dispatch('open-subject', { subjectId: brokenSubject.id });
  assert.match(harness.render(), /Trigger broken action/);

  harness.dispatch('broken-action-trigger');
  const afterErrorState = harness.store.getState();
  const afterErrorHtml = harness.render();

  assert.equal(afterErrorState.route.subjectId, brokenSubject.id);
  assert.equal(afterErrorState.learners.selectedId, learnerA);
  assert.equal(JSON.stringify(afterErrorState.subjectUi.spelling), spellingBeforeJson);
  assert.equal(afterErrorState.toasts.length, 1);
  assert.match(afterErrorHtml, /temporarily unavailable/i);

  harness.dispatch('navigate-home');
  assert.match(harness.render(), /Subject registry/);

  harness.dispatch('learner-create', { name: 'Learner B' });
  const learnerB = harness.store.getState().learners.selectedId;
  assert.notEqual(learnerB, learnerA);
  assert.match(harness.render(), /Learner B/);

  harness.dispatch('learner-select', { value: learnerA });
  assert.equal(harness.store.getState().learners.selectedId, learnerA);
  assert.equal(JSON.stringify(harness.store.getState().subjectUi.spelling), spellingBeforeJson);
});
