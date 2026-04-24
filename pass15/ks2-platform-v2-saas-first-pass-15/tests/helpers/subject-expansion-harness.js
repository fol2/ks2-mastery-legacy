import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSubjectModule } from '../../src/platform/core/subject-contract.js';
import { exportPlatformSnapshot, importPlatformSnapshot } from '../../src/platform/core/data-transfer.js';
import { installMemoryStorage } from './memory-storage.js';

export const THIN_SLICE_SERVICE_METHODS = Object.freeze([
  'initState',
  'getPrefs',
  'savePrefs',
  'getStats',
  'getAnalyticsSnapshot',
  'startSession',
  'submitAnswer',
  'continueSession',
  'endSession',
  'resetLearner',
]);

function findSubject(harness, subjectId) {
  return harness.subjects.find((subject) => subject.id === subjectId) || null;
}

function replaceSubject(subjects, subjectId, replacement) {
  return subjects.map((subject) => (subject.id === subjectId ? replacement : subject));
}

function assertDashboardStatsShape(stats) {
  assert.equal(typeof stats, 'object');
  assert.ok(stats);
  assert.equal(typeof stats.pct, 'number');
  assert.ok(Number.isFinite(stats.pct));
  assert.equal(typeof stats.due, 'number');
  assert.ok(Number.isFinite(stats.due));
  assert.equal(typeof stats.nextUp, 'string');
  assert.ok(stats.nextUp.length > 0);
}

function runPreparation(spec, harness) {
  if (typeof spec.prepareHarness === 'function') {
    spec.prepareHarness(harness);
  }
}

export function registerSubjectConformanceSuite(spec) {
  const requiredServiceMethods = spec.requiredServiceMethods || THIN_SLICE_SERVICE_METHODS;

  test(`${spec.label} satisfies the thin-slice module contract and shared-tab rendering`, () => {
    const storage = installMemoryStorage();
    const harness = spec.createHarness({ storage });
    runPreparation(spec, harness);

    const subject = findSubject(harness, spec.subjectId);
    assert.ok(subject, `Expected subject "${spec.subjectId}" to be present.`);
    validateSubjectModule(subject);

    const service = harness.services[spec.subjectId];
    assert.ok(service, `Expected service for subject "${spec.subjectId}".`);
    for (const method of requiredServiceMethods) {
      assert.equal(typeof service[method], 'function', `Expected ${spec.subjectId} service to expose ${method}().`);
    }

    harness.dispatch('open-subject', { subjectId: spec.subjectId });
    assert.match(harness.render(), spec.practiceMatcher);

    const stats = subject.getDashboardStats(harness.store.getState(), harness.contextFor(spec.subjectId));
    assertDashboardStatsShape(stats);
    spec.assertDashboardStats?.(stats, harness);

    harness.dispatch('subject-set-tab', { tab: 'analytics' });
    assert.match(harness.render(), spec.analyticsMatcher);

    harness.dispatch('subject-set-tab', { tab: 'profiles' });
    assert.match(harness.render(), spec.profilesMatcher);

    harness.dispatch('subject-set-tab', { tab: 'settings' });
    assert.match(harness.render(), spec.settingsMatcher);

    harness.dispatch('subject-set-tab', { tab: 'method' });
    assert.match(harness.render(), spec.methodMatcher);
  });

  test(`${spec.label} writes state, session, analytics, and domain events through the standard boundaries`, () => {
    const storage = installMemoryStorage();
    const harness = spec.createHarness({ storage });
    runPreparation(spec, harness);

    const learnerId = harness.store.getState().learners.selectedId;
    const service = harness.services[spec.subjectId];

    harness.dispatch('open-subject', { subjectId: spec.subjectId });
    const eventsBefore = harness.repositories.eventLog.list(learnerId).length;

    spec.startRound(harness);
    assert.ok(spec.isSessionState(spec.getUiState(harness)), `${spec.subjectId} should enter an active session.`);

    const activeRecord = harness.repositories.practiceSessions.latest(learnerId, spec.subjectId);
    assert.ok(activeRecord, 'Expected an active practice-session record.');
    assert.equal(activeRecord.status, 'active');

    spec.answerCorrectly(harness);
    const uiAfter = spec.getUiState(harness);
    assert.ok(spec.isSummaryState(uiAfter), `${spec.subjectId} should finish on its summary state.`);

    const persistedState = harness.repositories.subjectStates.read(learnerId, spec.subjectId);
    assert.deepEqual(persistedState.ui, uiAfter);

    const completedRecord = harness.repositories.practiceSessions.latest(learnerId, spec.subjectId);
    assert.ok(completedRecord, 'Expected a completed practice-session record.');
    assert.equal(completedRecord.status, 'completed');

    const eventsAfter = harness.repositories.eventLog.list(learnerId);
    assert.ok(eventsAfter.length > eventsBefore, 'Expected at least one published event.');
    if (spec.expectedCompletionEventType) {
      assert.equal(eventsAfter.some((event) => event.type === spec.expectedCompletionEventType), true);
    }

    const analytics = service.getAnalyticsSnapshot(learnerId);
    assert.equal(typeof analytics, 'object');
    assert.ok(analytics);
    spec.assertAnalytics?.(analytics, harness);
  });

  test(`${spec.label} stays contained when its render or action paths fail`, () => {
    const baseStorage = installMemoryStorage();
    const baseHarness = spec.createHarness({ storage: baseStorage });
    const baseSubject = findSubject(baseHarness, spec.subjectId);
    assert.ok(baseSubject, `Expected subject "${spec.subjectId}" to be present.`);

    const brokenRenderSubject = {
      ...baseSubject,
      renderPractice() {
        throw new Error(`${spec.subjectId} render exploded`);
      },
    };

    const renderHarness = spec.createHarness({
      storage: installMemoryStorage(),
      subjects: replaceSubject(baseHarness.subjects, spec.subjectId, brokenRenderSubject),
    });
    runPreparation(spec, renderHarness);
    renderHarness.dispatch('open-subject', { subjectId: spec.subjectId });
    const renderHtml = renderHarness.render();
    assert.match(renderHtml, /temporarily unavailable/i);
    assert.match(renderHtml, /Try this tab again/);

    const brokenActionSubject = {
      ...baseSubject,
      handleAction(action, context) {
        if (action === spec.triggerActionName) {
          throw new Error(`${spec.subjectId} action exploded`);
        }
        return baseSubject.handleAction(action, context);
      },
    };

    const actionHarness = spec.createHarness({
      storage: installMemoryStorage(),
      subjects: replaceSubject(baseHarness.subjects, spec.subjectId, brokenActionSubject),
    });
    runPreparation(spec, actionHarness);
    actionHarness.dispatch('open-subject', { subjectId: spec.subjectId });
    spec.triggerAction(actionHarness);
    const actionHtml = actionHarness.render();
    assert.equal(actionHarness.store.getState().route.subjectId, spec.subjectId);
    assert.match(actionHtml, /temporarily unavailable/i);
    assert.match(actionHtml, /Try this tab again/);
  });
}

export function registerGoldenPathSmokeSuite(spec) {
  test(`${spec.label} golden path runs from dashboard to session to summary and back`, () => {
    const storage = installMemoryStorage();
    const harness = spec.createHarness({ storage });
    runPreparation(spec, harness);

    harness.dispatch('open-subject', { subjectId: spec.subjectId });
    assert.match(harness.render(), spec.practiceMatcher);

    spec.startRound(harness);
    assert.ok(spec.isSessionState(spec.getUiState(harness)));
    assert.match(harness.render(), spec.sessionMatcher);

    spec.answerCorrectly(harness);
    assert.ok(spec.isSummaryState(spec.getUiState(harness)));
    assert.match(harness.render(), spec.summaryMatcher);

    spec.backToDashboard(harness);
    assert.equal(spec.getUiState(harness).phase, 'dashboard');
    assert.match(harness.render(), spec.practiceMatcher);
  });

  test(`${spec.label} keeps a live session when switching learners`, () => {
    const storage = installMemoryStorage();
    const harness = spec.createHarness({ storage });
    runPreparation(spec, harness);

    harness.dispatch('open-subject', { subjectId: spec.subjectId });
    spec.startRound(harness);
    const learnerA = harness.store.getState().learners.selectedId;
    const sessionBefore = structuredClone(spec.getUiState(harness));

    harness.dispatch('learner-create', { name: 'Learner B', yearGroup: 'Y4' });
    const learnerB = harness.store.getState().learners.selectedId;
    assert.notEqual(learnerB, learnerA);
    assert.equal(spec.getUiState(harness).phase, 'dashboard');
    assert.match(harness.render(), spec.practiceMatcher);

    harness.dispatch('learner-select', { value: learnerA });
    assert.equal(harness.store.getState().learners.selectedId, learnerA);
    assert.deepEqual(spec.getUiState(harness), sessionBefore);
    assert.match(harness.render(), spec.sessionMatcher);
  });

  test(`${spec.label} restores a live session through platform import/export`, () => {
    const storage = installMemoryStorage();
    const harness = spec.createHarness({ storage });
    runPreparation(spec, harness);

    harness.dispatch('open-subject', { subjectId: spec.subjectId });
    spec.startRound(harness);
    const exported = exportPlatformSnapshot(harness.repositories);
    const sessionBefore = structuredClone(spec.getUiState(harness));

    harness.store.clearAllProgress();
    importPlatformSnapshot(harness.repositories, exported);
    harness.runtimeBoundary.clearAll();
    harness.store.reloadFromRepositories();
    harness.dispatch('open-subject', { subjectId: spec.subjectId });

    assert.deepEqual(spec.getUiState(harness), sessionBefore);
    assert.ok(spec.isSessionState(spec.getUiState(harness)));
    assert.match(harness.render(), spec.sessionMatcher);
  });
}

export function typedFormData(value) {
  const formData = new FormData();
  formData.set('typed', value);
  return formData;
}
