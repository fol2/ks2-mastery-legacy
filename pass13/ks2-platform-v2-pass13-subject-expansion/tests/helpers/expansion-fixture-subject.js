import { createLocalPlatformRepositories, cloneSerialisable, normalisePracticeSessionRecord } from '../../src/platform/core/repositories/index.js';
import { escapeHtml } from '../../src/platform/core/utils.js';
import { SUBJECTS } from '../../src/platform/core/subject-registry.js';
import { createAppHarness } from './app-harness.js';

export const EXPANSION_FIXTURE_SUBJECT_ID = 'expansion-fixture';
const STATE_VERSION = 1;
const DEFAULT_PREFS = Object.freeze({ difficulty: 'mixed' });
const QUESTION_BANK = Object.freeze([
  { id: 'q-add-1', prompt: '3 + 4', answer: '7', explanation: '3 + 4 = 7.', skill: 'addition' },
  { id: 'q-sub-1', prompt: '9 - 5', answer: '4', explanation: '9 - 5 = 4.', skill: 'subtraction' },
  { id: 'q-mul-1', prompt: '6 × 2', answer: '12', explanation: '6 × 2 = 12.', skill: 'multiplication' },
]);

function nowTs(now = Date.now) {
  const value = typeof now === 'function' ? Number(now()) : Number(now);
  return Number.isFinite(value) ? value : Date.now();
}

function createInitialFixtureState() {
  return {
    version: STATE_VERSION,
    phase: 'dashboard',
    session: null,
    feedback: null,
    summary: null,
    error: '',
    awaitingAdvance: false,
  };
}

function clone(value) {
  return cloneSerialisable(value);
}

function buildTransition(state, { events = [], changed = true, ok = true } = {}) {
  return {
    ok,
    changed,
    state: clone(state),
    events: Array.isArray(events) ? events.filter(Boolean).map(clone) : [],
    audio: null,
  };
}

function readData(repositories, learnerId) {
  const raw = repositories.subjectStates.read(learnerId, EXPANSION_FIXTURE_SUBJECT_ID).data || {};
  const prefs = raw.prefs && typeof raw.prefs === 'object' && !Array.isArray(raw.prefs)
    ? { ...DEFAULT_PREFS, ...clone(raw.prefs) }
    : { ...DEFAULT_PREFS };
  const progressRaw = raw.progress && typeof raw.progress === 'object' && !Array.isArray(raw.progress)
    ? raw.progress
    : {};
  return {
    prefs,
    progress: {
      attempts: Number.isInteger(Number(progressRaw.attempts)) ? Number(progressRaw.attempts) : 0,
      correct: Number.isInteger(Number(progressRaw.correct)) ? Number(progressRaw.correct) : 0,
      nextIndex: Number.isInteger(Number(progressRaw.nextIndex)) ? Number(progressRaw.nextIndex) : 0,
      sessionsCompleted: Number.isInteger(Number(progressRaw.sessionsCompleted)) ? Number(progressRaw.sessionsCompleted) : 0,
      lastQuestionId: typeof progressRaw.lastQuestionId === 'string' ? progressRaw.lastQuestionId : null,
    },
  };
}

function writeData(repositories, learnerId, nextData) {
  return repositories.subjectStates.writeData(learnerId, EXPANSION_FIXTURE_SUBJECT_ID, clone(nextData)).data;
}

function questionAt(index) {
  const safeIndex = Number.isInteger(index) ? index : 0;
  return clone(QUESTION_BANK[((safeIndex % QUESTION_BANK.length) + QUESTION_BANK.length) % QUESTION_BANK.length]);
}

function activeRecord(learnerId, session, now) {
  return normalisePracticeSessionRecord({
    id: session.id,
    learnerId,
    subjectId: EXPANSION_FIXTURE_SUBJECT_ID,
    sessionKind: 'practice',
    status: 'active',
    sessionState: clone(session),
    summary: null,
    createdAt: session.startedAt,
    updatedAt: nowTs(now),
  });
}

function completedRecord(learnerId, session, summary, now) {
  return normalisePracticeSessionRecord({
    id: session.id,
    learnerId,
    subjectId: EXPANSION_FIXTURE_SUBJECT_ID,
    sessionKind: 'practice',
    status: 'completed',
    sessionState: null,
    summary: clone(summary),
    createdAt: session.startedAt,
    updatedAt: nowTs(now),
  });
}

function abandonedRecord(learnerId, session, now) {
  return normalisePracticeSessionRecord({
    id: session.id,
    learnerId,
    subjectId: EXPANSION_FIXTURE_SUBJECT_ID,
    sessionKind: 'practice',
    status: 'abandoned',
    sessionState: clone(session),
    summary: null,
    createdAt: session.startedAt,
    updatedAt: nowTs(now),
  });
}

function feedbackFor(question, correct) {
  return {
    kind: correct ? 'success' : 'error',
    headline: correct ? 'Correct.' : 'Not quite.',
    body: correct ? `${question.prompt} = ${question.answer}.` : `Correct answer: ${question.answer}. ${question.explanation}`,
    answer: question.answer,
  };
}

function summaryFor(question, progress, correct) {
  return {
    label: 'Expansion fixture summary',
    message: correct ? 'Round complete.' : 'Review the correct answer.',
    cards: [
      { label: 'Answered', value: progress.attempts, sub: 'Across this learner profile' },
      { label: 'Correct', value: progress.correct, sub: 'Cumulative correct answers' },
      { label: 'Last item', value: question.prompt, sub: question.skill },
    ],
    questionId: question.id,
    correct,
    explanation: question.explanation,
    answer: question.answer,
  };
}

export function createExpansionFixtureService({ repositories, now = Date.now } = {}) {
  if (!repositories) {
    throw new TypeError('Expansion fixture service requires platform repositories.');
  }

  const clock = () => nowTs(now);

  return {
    initState(rawState) {
      const fallback = createInitialFixtureState();
      const raw = rawState && typeof rawState === 'object' && !Array.isArray(rawState) ? clone(rawState) : {};
      const phase = ['dashboard', 'session', 'summary'].includes(raw.phase) ? raw.phase : fallback.phase;
      return {
        ...fallback,
        ...raw,
        phase,
      };
    },
    getPrefs(learnerId) {
      return clone(readData(repositories, learnerId).prefs);
    },
    savePrefs(learnerId, patch = {}) {
      const current = readData(repositories, learnerId);
      const next = {
        ...current,
        prefs: {
          ...current.prefs,
          ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}),
        },
      };
      writeData(repositories, learnerId, next);
      return clone(next.prefs);
    },
    getStats(learnerId) {
      const { progress } = readData(repositories, learnerId);
      return {
        attempts: progress.attempts,
        correct: progress.correct,
        accuracy: progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0,
        due: progress.attempts ? 0 : 1,
        nextUp: progress.lastQuestionId ? 'Next deterministic item' : 'First deterministic item',
      };
    },
    getAnalyticsSnapshot(learnerId) {
      const { progress } = readData(repositories, learnerId);
      return {
        attempts: progress.attempts,
        correct: progress.correct,
        accuracy: progress.attempts ? Math.round((progress.correct / progress.attempts) * 100) : 0,
        sessionsCompleted: progress.sessionsCompleted,
        lastQuestionId: progress.lastQuestionId,
      };
    },
    startSession(learnerId) {
      const current = readData(repositories, learnerId);
      const question = questionAt(current.progress.nextIndex);
      const session = {
        id: `fixture-session-${clock()}`,
        startedAt: clock(),
        currentQuestion: question,
      };
      repositories.practiceSessions.write(activeRecord(learnerId, session, clock));
      return buildTransition({
        ...createInitialFixtureState(),
        phase: 'session',
        session,
      });
    },
    submitAnswer(learnerId, uiState, typed) {
      const ui = this.initState(uiState);
      const question = ui.session?.currentQuestion;
      if (!question) {
        return buildTransition(ui, { ok: false, changed: false });
      }
      const correct = String(typed || '').trim() === String(question.answer);
      const current = readData(repositories, learnerId);
      const nextData = {
        ...current,
        progress: {
          attempts: current.progress.attempts + 1,
          correct: current.progress.correct + (correct ? 1 : 0),
          nextIndex: current.progress.nextIndex + 1,
          sessionsCompleted: current.progress.sessionsCompleted + 1,
          lastQuestionId: question.id,
        },
      };
      writeData(repositories, learnerId, nextData);
      const summary = summaryFor(question, nextData.progress, correct);
      repositories.practiceSessions.write(completedRecord(learnerId, ui.session, summary, clock));
      return buildTransition({
        ...createInitialFixtureState(),
        phase: 'summary',
        feedback: feedbackFor(question, correct),
        summary,
      }, {
        events: [{
          id: `expansion-fixture.session-completed:${learnerId}:${ui.session.id}`,
          type: 'expansion-fixture.session-completed',
          subjectId: EXPANSION_FIXTURE_SUBJECT_ID,
          learnerId,
          sessionId: ui.session.id,
          questionId: question.id,
          correct,
          createdAt: clock(),
        }],
      });
    },
    continueSession(_learnerId, uiState) {
      const ui = this.initState(uiState);
      if (ui.phase !== 'summary') {
        return buildTransition(ui, { changed: false });
      }
      return buildTransition(createInitialFixtureState());
    },
    endSession(learnerId, uiState) {
      const ui = this.initState(uiState);
      if (ui.session) {
        repositories.practiceSessions.write(abandonedRecord(learnerId, ui.session, clock));
      }
      return buildTransition(createInitialFixtureState());
    },
    resetLearner(learnerId) {
      writeData(repositories, learnerId, { prefs: { ...DEFAULT_PREFS }, progress: {} });
      repositories.practiceSessions.clear(learnerId, EXPANSION_FIXTURE_SUBJECT_ID);
    },
  };
}

function renderDashboard(context, learnerId) {
  const stats = context.service.getStats(learnerId);
  return `
    <section class="card">
      <div class="eyebrow">Candidate subject fixture</div>
      <h2 class="section-title">Expansion fixture practice</h2>
      <p class="subtitle">This is a non-production thin slice used only to prove the subject expansion harness. It deliberately uses the same shell, repository, session, and event boundaries as a real future subject.</p>
      <div class="chip-row" style="margin-top:14px;">
        <span class="chip">Answered ${stats.attempts}</span>
        <span class="chip">Accuracy ${stats.accuracy}%</span>
        <span class="chip">Due ${stats.due}</span>
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="btn primary" data-action="fixture-start">Start deterministic round</button>
      </div>
    </section>
  `;
}

function renderSession(context, learnerId, ui) {
  const question = ui.session?.currentQuestion;
  return `
    <section class="card">
      <div class="eyebrow">Candidate subject fixture</div>
      <h2 class="section-title">Expansion fixture live round</h2>
      <p class="subtitle">${escapeHtml(context.appState.learners.byId[learnerId].name)} · deterministic prompt</p>
      <div class="callout" style="margin-top:14px;">Solve: <strong>${escapeHtml(question.prompt)}</strong></div>
      <form data-action="fixture-submit-form" style="margin-top:16px; display:grid; gap:12px;">
        <label class="field">
          <span>Your answer</span>
          <input class="input" name="typed" data-autofocus="true" autocomplete="off" />
        </label>
        <div class="actions">
          <button class="btn primary" type="submit">Submit answer</button>
          <button class="btn secondary" type="button" data-action="fixture-back">End round</button>
        </div>
      </form>
    </section>
  `;
}

function renderSummary(ui) {
  const summary = ui.summary || {};
  const feedback = ui.feedback || {};
  return `
    <section class="card">
      <div class="eyebrow">Candidate subject fixture</div>
      <h2 class="section-title">Expansion fixture summary</h2>
      <p class="subtitle">${escapeHtml(summary.message || '')}</p>
      <div class="feedback ${feedback.kind === 'success' ? 'good' : 'warn'}" style="margin-top:14px;">
        <strong>${escapeHtml(feedback.headline || '')}</strong>
        <div style="margin-top:8px;">${escapeHtml(feedback.body || '')}</div>
      </div>
      <div class="stat-grid" style="margin-top:16px;">
        ${(summary.cards || []).map((card) => `
          <div class="stat">
            <div class="stat-label">${escapeHtml(card.label)}</div>
            <div class="stat-value">${escapeHtml(String(card.value))}</div>
            <div class="stat-sub">${escapeHtml(card.sub)}</div>
          </div>
        `).join('')}
      </div>
      <div class="actions" style="margin-top:16px;">
        <button class="btn secondary" data-action="fixture-back">Back to fixture dashboard</button>
      </div>
    </section>
  `;
}

export const expansionFixtureModule = {
  id: EXPANSION_FIXTURE_SUBJECT_ID,
  name: 'Expansion Fixture',
  blurb: 'Thin, non-production subject used to prove the expansion gate.',
  accent: '#7C3AED',
  accentSoft: '#E9D8FD',
  accentTint: '#F5EEFF',
  icon: 'plus',
  available: true,
  initState() {
    return createInitialFixtureState();
  },
  getDashboardStats(appState, { service }) {
    const learnerId = appState.learners.selectedId;
    const stats = service.getStats(learnerId);
    return {
      pct: stats.accuracy,
      due: stats.due,
      streak: stats.correct,
      nextUp: stats.nextUp,
    };
  },
  renderPractice(context) {
    const learnerId = context.appState.learners.selectedId;
    const ui = context.service.initState(context.appState.subjectUi[EXPANSION_FIXTURE_SUBJECT_ID], learnerId);
    if (ui.phase === 'session') return renderSession(context, learnerId, ui);
    if (ui.phase === 'summary') return renderSummary(ui);
    return renderDashboard(context, learnerId);
  },
  renderAnalytics(context) {
    const learnerId = context.appState.learners.selectedId;
    const analytics = context.service.getAnalyticsSnapshot(learnerId);
    return `
      <section class="card">
        <div class="eyebrow">Candidate subject fixture</div>
        <h2 class="section-title">Expansion fixture analytics</h2>
        <div class="chip-row">
          <span class="chip">Answered ${analytics.attempts}</span>
          <span class="chip">Correct ${analytics.correct}</span>
          <span class="chip">Accuracy ${analytics.accuracy}%</span>
          <span class="chip">Sessions ${analytics.sessionsCompleted}</span>
        </div>
      </section>
    `;
  },
  renderProfiles() {
    return `
      <section class="card">
        <div class="eyebrow">Candidate subject fixture</div>
        <h2 class="section-title">Expansion fixture learner hooks</h2>
        <p class="subtitle">Profiles still belong to the platform. The fixture only consumes the shared learner record.</p>
      </section>
    `;
  },
  renderSettings(context) {
    const learnerId = context.appState.learners.selectedId;
    const prefs = context.service.getPrefs(learnerId);
    return `
      <section class="card">
        <div class="eyebrow">Candidate subject fixture</div>
        <h2 class="section-title">Expansion fixture settings</h2>
        <p class="subtitle">Current difficulty preference: <strong>${escapeHtml(prefs.difficulty)}</strong></p>
      </section>
    `;
  },
  renderMethod() {
    return `
      <section class="card">
        <div class="eyebrow">Candidate subject fixture</div>
        <h2 class="section-title">Expansion fixture method</h2>
        <div class="code-block">subject module → deterministic service → generic repositories → event publication → analytics snapshot</div>
      </section>
    `;
  },
  handleAction(action, context) {
    const learnerId = context.appState.learners.selectedId;
    const ui = context.service.initState(context.appState.subjectUi[EXPANSION_FIXTURE_SUBJECT_ID], learnerId);

    function apply(transition) {
      return context.applySubjectTransition(EXPANSION_FIXTURE_SUBJECT_ID, transition);
    }

    if (action === 'fixture-start') {
      return apply(context.service.startSession(learnerId));
    }

    if (action === 'fixture-submit-form') {
      const typed = context.data.formData.get('typed');
      return apply(context.service.submitAnswer(learnerId, ui, typed));
    }

    if (action === 'fixture-back') {
      return apply(context.service.endSession(learnerId, ui));
    }

    if (action === 'fixture-set-pref') {
      context.service.savePrefs(learnerId, { difficulty: context.data.value || 'mixed' });
      context.store.updateSubjectUi(EXPANSION_FIXTURE_SUBJECT_ID, createInitialFixtureState());
      return true;
    }

    return false;
  },
};

export function createExpansionFixtureHarness({ storage, subjects = null, now = () => Date.now() } = {}) {
  const repositories = createLocalPlatformRepositories({ storage });
  const subjectList = subjects || [...SUBJECTS, expansionFixtureModule];
  const extraServices = {
    [EXPANSION_FIXTURE_SUBJECT_ID]: createExpansionFixtureService({ repositories, now }),
  };
  return createAppHarness({
    storage,
    repositories,
    subjects: subjectList,
    now,
    extraServices,
  });
}
