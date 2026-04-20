import { createStore } from '../../src/platform/core/store.js';
import { createLocalPlatformRepositories } from '../../src/platform/core/repositories/index.js';
import { createEventRuntime, createPracticeStreakSubscriber } from '../../src/platform/events/index.js';
import { createSubjectRuntimeBoundary } from '../../src/platform/core/subject-runtime.js';
import { createSpellingService } from '../../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../../src/subjects/spelling/repository.js';
import { createSpellingRewardSubscriber } from '../../src/subjects/spelling/event-hooks.js';
import { createSpellingAutoAdvanceController } from '../../src/subjects/spelling/auto-advance.js';
import { resolveSpellingShortcut } from '../../src/subjects/spelling/shortcuts.js';
import { renderApp } from '../../src/platform/ui/render.js';
import { SUBJECTS } from '../../src/platform/core/subject-registry.js';

export function makeTts() {
  return {
    spoken: [],
    speak(payload) {
      this.spoken.push(payload);
    },
    stop() {},
    warmup() {},
  };
}

function resolveSubject(subjects, subjectId) {
  return subjects.find((subject) => subject.id === subjectId) || subjects[0];
}

export function createAppHarness({
  storage,
  repositories = createLocalPlatformRepositories({ storage }),
  subjects = SUBJECTS,
  now = () => Date.now(),
  subscribers = null,
  runtimeBoundary = createSubjectRuntimeBoundary(),
  scheduler = null,
  extraServices = {},
} = {}) {
  const tts = makeTts();
  const services = {
    spelling: createSpellingService({
      repository: createSpellingPersistence({ repositories, now }),
      now,
      tts,
    }),
    ...extraServices,
  };

  const eventRuntime = createEventRuntime({
    repositories,
    subscribers: subscribers || [
      createPracticeStreakSubscriber(),
      createSpellingRewardSubscriber({ gameStateRepository: repositories.gameState }),
    ],
  });

  const store = createStore(subjects, { repositories });
  const autoAdvance = createSpellingAutoAdvanceController({
    getState: () => store.getState(),
    dispatchContinue: () => dispatch('spelling-continue'),
    setTimeoutFn: scheduler?.setTimeout?.bind(scheduler),
    clearTimeoutFn: scheduler?.clearTimeout?.bind(scheduler),
  });

  function applySubjectTransition(subjectId, transition) {
    if (!transition) return false;
    store.updateSubjectUi(subjectId, transition.state);
    const published = eventRuntime.publish(transition.events);
    if (published.toastEvents.length) {
      store.pushToasts(published.toastEvents);
    } else if (published.reactionEvents.length) {
      store.patch(() => ({}));
    }
    runtimeBoundary.clear({
      learnerId: store.getState().learners.selectedId,
      subjectId,
      tab: store.getState().route.tab || 'practice',
    });
    if (transition.audio?.word) tts.speak(transition.audio);
    if (subjectId === 'spelling') autoAdvance.scheduleFromTransition(transition);
    return true;
  }

  function contextFor(subjectId = null) {
    const appState = store.getState();
    const subject = resolveSubject(subjects, subjectId || appState.route.subjectId || 'spelling');
    return {
      appState,
      store,
      services,
      repositories,
      subject,
      service: services[subject.id] || null,
      tts,
      applySubjectTransition,
      runtimeBoundary,
      subjects,
    };
  }

  function render() {
    const appState = store.getState();
    return renderApp(appState, contextFor(appState.route.subjectId || 'spelling'));
  }

  function dispatch(action, data = {}) {
    autoAdvance.clear();
    const appState = store.getState();
    const learnerId = appState.learners.selectedId;

    if (action === 'navigate-home') {
      tts.stop();
      store.goHome();
      return true;
    }

    if (action === 'open-subject') {
      tts.stop();
      store.openSubject(data.subjectId || 'spelling');
      return true;
    }

    if (action === 'subject-set-tab') {
      store.setTab(data.tab || 'practice');
      return true;
    }

    if (action === 'learner-select') {
      tts.stop();
      runtimeBoundary.clearAll();
      store.selectLearner(data.value);
      return true;
    }

    if (action === 'learner-create') {
      const current = appState.learners.byId[learnerId];
      store.createLearner({
        name: data.name || `Learner ${appState.learners.allIds.length + 1}`,
        yearGroup: data.yearGroup || current?.yearGroup || 'Y5',
        goal: data.goal || current?.goal || 'sats',
        dailyMinutes: data.dailyMinutes || current?.dailyMinutes || 15,
        avatarColor: data.avatarColor || current?.avatarColor || '#3E6FA8',
      });
      return true;
    }

    if (action === 'persistence-retry') {
      repositories.persistence.retry().catch(() => {
        // persistence state remains visible through the subscribed store snapshot.
      });
      return true;
    }

    if (action === 'subject-runtime-retry') {
      runtimeBoundary.clear({
        learnerId,
        subjectId: appState.route.subjectId || 'spelling',
        tab: appState.route.tab || 'practice',
      });
      store.patch(() => ({}));
      return true;
    }

    const subject = resolveSubject(subjects, appState.route.subjectId || 'spelling');
    const tab = appState.route.tab || 'practice';
    try {
      const handled = subject.handleAction?.(action, {
        ...contextFor(subject.id),
        data,
      });
      if (handled) {
        runtimeBoundary.clear({ learnerId, subjectId: subject.id, tab });
      }
      return Boolean(handled);
    } catch (error) {
      tts.stop();
      runtimeBoundary.capture({
        learnerId,
        subject,
        tab,
        phase: 'action',
        methodName: 'handleAction',
        action,
        error,
      });
      store.patch(() => ({}));
      return true;
    }
  }

  function keydown(eventLike = {}) {
    const shortcut = resolveSpellingShortcut(eventLike, store.getState());
    if (!shortcut) return false;
    if (shortcut.action) {
      dispatch(shortcut.action, shortcut.data || {});
      return true;
    }
    return Boolean(shortcut.focusSelector);
  }

  return {
    store,
    repositories,
    services,
    tts,
    eventRuntime,
    runtimeBoundary,
    subjects,
    contextFor,
    render,
    dispatch,
    keydown,
    autoAdvance,
    scheduler,
  };
}
