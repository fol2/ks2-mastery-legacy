import assert from 'node:assert/strict';

import { createAppHarness } from './helpers/app-harness.js';
import {
  registerGoldenPathSmokeSuite,
  registerSubjectConformanceSuite,
  typedFormData,
} from './helpers/subject-expansion-harness.js';
import {
  createExpansionFixtureHarness,
  EXPANSION_FIXTURE_SUBJECT_ID,
} from './helpers/expansion-fixture-subject.js';

function createSpellingHarness({ storage, subjects } = {}) {
  return createAppHarness({ storage, subjects });
}

function prepareSpellingHarness(harness) {
  const learnerId = harness.store.getState().learners.selectedId;
  harness.services.spelling.savePrefs(learnerId, {
    mode: 'smart',
    roundLength: '1',
  });
}

function answerSpellingCorrectly(harness) {
  while (harness.store.getState().subjectUi.spelling.phase === 'session') {
    const state = harness.store.getState().subjectUi.spelling;
    const answer = state.session.currentCard.word.word;
    harness.dispatch('spelling-submit-form', { formData: typedFormData(answer) });
    if (
      harness.store.getState().subjectUi.spelling.phase === 'session'
      && harness.store.getState().subjectUi.spelling.awaitingAdvance
    ) {
      harness.dispatch('spelling-continue');
    }
  }
}

const spellingSpec = {
  label: 'Spelling reference subject',
  subjectId: 'spelling',
  createHarness: createSpellingHarness,
  prepareHarness: prepareSpellingHarness,
  practiceMatcher: /Practice setup/,
  sessionMatcher: /Spell the word you hear|Spell the dictated word/,
  summaryMatcher: /Session summary/,
  analyticsMatcher: /Whole-list progress/,
  profilesMatcher: /Spelling profile hooks/,
  settingsMatcher: /Current defaults/,
  methodMatcher: /What Spelling owns/,
  getUiState(harness) {
    return harness.store.getState().subjectUi.spelling;
  },
  isSessionState(ui) {
    return ui.phase === 'session';
  },
  isSummaryState(ui) {
    return ui.phase === 'summary';
  },
  startRound(harness) {
    harness.dispatch('spelling-start');
  },
  answerCorrectly: answerSpellingCorrectly,
  backToDashboard(harness) {
    harness.dispatch('spelling-back');
  },
  triggerActionName: 'spelling-start',
  triggerAction(harness) {
    harness.dispatch('spelling-start');
  },
  expectedCompletionEventType: 'spelling.session-completed',
  assertDashboardStats(stats) {
    assert.ok(stats.pct >= 0 && stats.pct <= 100);
  },
  assertAnalytics(analytics) {
    assert.ok(analytics.pools.all.attempts >= 1);
    assert.ok(analytics.pools.all.correct >= 0);
  },
};

const expansionFixtureSpec = {
  label: 'Expansion fixture candidate subject',
  subjectId: EXPANSION_FIXTURE_SUBJECT_ID,
  createHarness: createExpansionFixtureHarness,
  practiceMatcher: /Expansion fixture practice/,
  sessionMatcher: /Expansion fixture live round/,
  summaryMatcher: /Expansion fixture summary/,
  analyticsMatcher: /Expansion fixture analytics/,
  profilesMatcher: /Expansion fixture learner hooks/,
  settingsMatcher: /Expansion fixture settings/,
  methodMatcher: /Expansion fixture method/,
  getUiState(harness) {
    return harness.store.getState().subjectUi[EXPANSION_FIXTURE_SUBJECT_ID];
  },
  isSessionState(ui) {
    return ui.phase === 'session';
  },
  isSummaryState(ui) {
    return ui.phase === 'summary';
  },
  startRound(harness) {
    harness.dispatch('fixture-start');
  },
  answerCorrectly(harness) {
    const state = harness.store.getState().subjectUi[EXPANSION_FIXTURE_SUBJECT_ID];
    harness.dispatch('fixture-submit-form', {
      formData: typedFormData(state.session.currentQuestion.answer),
    });
  },
  backToDashboard(harness) {
    harness.dispatch('fixture-back');
  },
  triggerActionName: 'fixture-start',
  triggerAction(harness) {
    harness.dispatch('fixture-start');
  },
  expectedCompletionEventType: 'expansion-fixture.session-completed',
  assertDashboardStats(stats) {
    assert.ok(stats.pct >= 0 && stats.pct <= 100);
    assert.equal(typeof stats.streak, 'number');
  },
  assertAnalytics(analytics) {
    assert.equal(analytics.attempts, 1);
    assert.equal(analytics.correct, 1);
    assert.equal(analytics.accuracy, 100);
    assert.equal(analytics.sessionsCompleted, 1);
  },
};

registerSubjectConformanceSuite(spellingSpec);
registerGoldenPathSmokeSuite(spellingSpec);
registerSubjectConformanceSuite(expansionFixtureSpec);
registerGoldenPathSmokeSuite(expansionFixtureSpec);
