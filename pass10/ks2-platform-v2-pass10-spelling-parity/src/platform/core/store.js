import { uid } from './utils.js';
import { buildSubjectRegistry } from './subject-contract.js';
import {
  createLocalPlatformRepositories,
  defaultPersistenceSnapshot,
  normaliseLearnersSnapshot,
  normalisePersistenceSnapshot,
  validatePlatformRepositories,
} from './repositories/index.js';

const DEFAULT_ROUTE = {
  screen: 'dashboard',
  subjectId: null,
  tab: 'practice',
};

const VALID_ROUTE_SCREENS = new Set(['dashboard', 'subject']);
const VALID_ROUTE_TABS = new Set(['practice', 'analytics', 'profiles', 'settings', 'method']);

const DEFAULT_SUBJECT_UI = {
  phase: 'dashboard',
  session: null,
  feedback: null,
  summary: null,
  error: '',
};

function makeLearner(name = 'Learner 1') {
  return {
    id: uid('learner'),
    name,
    yearGroup: 'Y5',
    avatarColor: '#3E6FA8',
    goal: 'sats',
    dailyMinutes: 15,
    weakSubjects: [],
    createdAt: Date.now(),
  };
}

function buildSubjectUiState(subject, persistedEntry = null) {
  const initialState = subject.initState();
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    throw new TypeError(`Subject "${subject.id}" initState() must return an object.`);
  }

  const persisted = persistedEntry && typeof persistedEntry === 'object' && !Array.isArray(persistedEntry)
    ? persistedEntry
    : null;

  return {
    ...DEFAULT_SUBJECT_UI,
    ...initialState,
    ...(persisted || {}),
  };
}

function buildSubjectUiTree(subjects, persistedUi = {}) {
  return Object.fromEntries(subjects.map((subject) => [
    subject.id,
    buildSubjectUiState(subject, persistedUi[subject.id] || null),
  ]));
}

function emptyState(subjects, learner) {
  return {
    route: { ...DEFAULT_ROUTE },
    learners: {
      byId: { [learner.id]: learner },
      allIds: [learner.id],
      selectedId: learner.id,
    },
    subjectUi: buildSubjectUiTree(subjects),
    persistence: defaultPersistenceSnapshot(),
    toasts: [],
  };
}

function ensureLearnersSnapshot(repositories, subjects) {
  const snapshot = normaliseLearnersSnapshot(repositories.learners.read());
  if (snapshot.allIds.length) return snapshot;

  const learner = makeLearner();
  const initial = emptyState(subjects, learner);
  repositories.learners.write(initial.learners);
  return initial.learners;
}

function normaliseRoute(rawRoute, subjects) {
  const raw = rawRoute && typeof rawRoute === 'object' && !Array.isArray(rawRoute) ? rawRoute : {};
  const screen = VALID_ROUTE_SCREENS.has(raw.screen) ? raw.screen : DEFAULT_ROUTE.screen;
  const tab = VALID_ROUTE_TABS.has(raw.tab) ? raw.tab : DEFAULT_ROUTE.tab;
  const subjectId = typeof raw.subjectId === 'string' && subjects.some((subject) => subject.id === raw.subjectId)
    ? raw.subjectId
    : null;

  if (screen === 'subject' && subjectId) {
    return { screen, subjectId, tab };
  }

  return { ...DEFAULT_ROUTE };
}

function normaliseToasts(rawValue) {
  return (Array.isArray(rawValue) ? rawValue : [])
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .slice(-25);
}

function stateFromRepositories(subjects, repositories) {
  const learners = ensureLearnersSnapshot(repositories, subjects);
  const selectedId = learners.selectedId;
  const records = selectedId ? repositories.subjectStates.readForLearner(selectedId) : {};
  const persistedUi = Object.fromEntries(Object.entries(records).map(([subjectId, record]) => [subjectId, record.ui]));

  return {
    route: { ...DEFAULT_ROUTE },
    learners,
    subjectUi: buildSubjectUiTree(subjects, persistedUi),
    persistence: repositories.persistence.read(),
    toasts: [],
  };
}

function sanitiseState(rawState, subjects) {
  const learners = normaliseLearnersSnapshot(rawState?.learners);
  return {
    route: normaliseRoute(rawState?.route, subjects),
    learners,
    subjectUi: buildSubjectUiTree(subjects, rawState?.subjectUi || {}),
    persistence: normalisePersistenceSnapshot(rawState?.persistence),
    toasts: normaliseToasts(rawState?.toasts),
  };
}

function subjectUiForLearner(registry, repositories, learnerId) {
  const records = learnerId ? repositories.subjectStates.readForLearner(learnerId) : {};
  const persistedUi = Object.fromEntries(Object.entries(records).map(([subjectId, record]) => [subjectId, record.ui]));
  return buildSubjectUiTree(registry, persistedUi);
}

export function createStore(subjects, { repositories } = {}) {
  const registry = buildSubjectRegistry(subjects);
  const resolvedRepositories = validatePlatformRepositories(repositories || createLocalPlatformRepositories());
  let state = sanitiseState(stateFromRepositories(registry, resolvedRepositories), registry);
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) {
      try { listener(state); } catch {
        // rendering listeners must not break store updates
      }
    }
  }

  function setState(updater) {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    state = sanitiseState(nextState, registry);
    notify();
  }

  resolvedRepositories.persistence.subscribe((snapshot) => {
    state = sanitiseState({ ...state, persistence: snapshot }, registry);
    notify();
  });

  function persistLearners(nextLearners) {
    return resolvedRepositories.learners.write(nextLearners);
  }

  function reloadFromRepositories() {
    state = sanitiseState(stateFromRepositories(registry, resolvedRepositories), registry);
    notify();
    return state;
  }

  function resetSubjectUi() {
    const learnerId = state.learners.selectedId;
    const nextTree = buildSubjectUiTree(registry);
    if (learnerId) {
      for (const subject of registry) {
        resolvedRepositories.subjectStates.writeUi(learnerId, subject.id, nextTree[subject.id]);
      }
    }
    setState((current) => ({
      ...current,
      subjectUi: nextTree,
    }));
  }

  return {
    repositories: resolvedRepositories,
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState,
    reloadFromRepositories,
    patch(updater) {
      setState((current) => ({ ...current, ...updater(current) }));
    },
    goHome() {
      setState((current) => ({ ...current, route: { ...DEFAULT_ROUTE } }));
    },
    openSubject(subjectId, tab = 'practice') {
      setState((current) => ({
        ...current,
        route: normaliseRoute({ screen: 'subject', subjectId, tab }, registry),
      }));
    },
    setTab(tab) {
      setState((current) => ({
        ...current,
        route: normaliseRoute({ ...current.route, screen: 'subject', tab }, registry),
      }));
    },
    selectLearner(learnerId) {
      if (!state.learners.byId[learnerId]) return;
      setState((current) => ({
        ...current,
        learners: { ...current.learners, selectedId: learnerId },
        subjectUi: subjectUiForLearner(registry, resolvedRepositories, learnerId),
      }));
      persistLearners({ ...state.learners, selectedId: learnerId });
    },
    createLearner(payload = {}) {
      const learner = {
        ...makeLearner(`Learner ${state.learners.allIds.length + 1}`),
        ...payload,
      };
      const nextLearners = {
        byId: { ...state.learners.byId, [learner.id]: learner },
        allIds: [...state.learners.allIds, learner.id],
        selectedId: learner.id,
      };
      persistLearners(nextLearners);
      setState((current) => ({
        ...current,
        learners: nextLearners,
        subjectUi: subjectUiForLearner(registry, resolvedRepositories, learner.id),
      }));
      return learner;
    },
    updateLearner(learnerId, patch) {
      if (!state.learners.byId[learnerId]) return;
      const nextLearners = {
        ...state.learners,
        byId: {
          ...state.learners.byId,
          [learnerId]: { ...state.learners.byId[learnerId], ...patch },
        },
      };
      persistLearners(nextLearners);
      setState((current) => ({
        ...current,
        learners: nextLearners,
      }));
    },
    deleteLearner(learnerId) {
      if (state.learners.allIds.length <= 1) return false;
      if (!state.learners.byId[learnerId]) return false;
      const nextById = { ...state.learners.byId };
      delete nextById[learnerId];
      const nextIds = state.learners.allIds.filter((id) => id !== learnerId);
      const nextSelectedId = state.learners.selectedId === learnerId ? nextIds[0] : state.learners.selectedId;
      const nextLearners = {
        byId: nextById,
        allIds: nextIds,
        selectedId: nextSelectedId,
      };
      resolvedRepositories.subjectStates.clearLearner(learnerId);
      resolvedRepositories.practiceSessions.clearLearner(learnerId);
      resolvedRepositories.gameState.clearLearner(learnerId);
      resolvedRepositories.eventLog.clearLearner(learnerId);
      persistLearners(nextLearners);
      setState((current) => ({
        ...current,
        learners: nextLearners,
        subjectUi: subjectUiForLearner(registry, resolvedRepositories, nextSelectedId),
      }));
      return true;
    },
    updateSubjectUi(subjectId, updater) {
      const learnerId = state.learners.selectedId;
      setState((current) => {
        const previous = current.subjectUi[subjectId] || {};
        const nextEntry = typeof updater === 'function'
          ? updater(previous)
          : { ...previous, ...updater };

        if (learnerId) {
          resolvedRepositories.subjectStates.writeUi(learnerId, subjectId, nextEntry);
        }

        return {
          ...current,
          subjectUi: {
            ...current.subjectUi,
            [subjectId]: nextEntry,
          },
        };
      });
    },
    pushToasts(events) {
      const entries = Array.isArray(events) ? events : [events];
      const validEvents = entries.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
      if (!validEvents.length) return;
      setState((current) => ({
        ...current,
        toasts: [...current.toasts, ...validEvents].slice(-25),
      }));
    },
    dismissToast(index) {
      setState((current) => ({
        ...current,
        toasts: current.toasts.filter((_, currentIndex) => currentIndex !== index),
      }));
    },
    clearToasts() {
      setState((current) => ({ ...current, toasts: [] }));
    },
    clearAllProgress() {
      resolvedRepositories.clearAll();
      reloadFromRepositories();
    },
    resetSubjectUi,
  };
}
