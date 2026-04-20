export function spellingAutoAdvanceDelay(state) {
  if (!state || state.phase !== 'session' || !state.awaitingAdvance || !state.session) return null;
  return state.session.type === 'test' ? 320 : 500;
}

function snapshotFromState(state, appState) {
  return {
    learnerId: appState?.learners?.selectedId || null,
    sessionId: state?.session?.id || null,
    subjectId: appState?.route?.subjectId || 'spelling',
  };
}

function stillMatches(snapshot, appState) {
  if (!snapshot || !appState) return false;
  if ((appState.route?.subjectId || null) !== snapshot.subjectId) return false;
  if ((appState.learners?.selectedId || null) !== snapshot.learnerId) return false;
  const state = appState.subjectUi?.spelling;
  return Boolean(
    state
      && state.phase === 'session'
      && state.awaitingAdvance
      && state.session?.id === snapshot.sessionId,
  );
}

export function createSpellingAutoAdvanceController({
  getState,
  dispatchContinue,
  setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
} = {}) {
  let pendingHandle = null;
  let pendingSnapshot = null;

  function clear() {
    if (pendingHandle != null && typeof clearTimeoutFn === 'function') {
      clearTimeoutFn(pendingHandle);
    }
    pendingHandle = null;
    pendingSnapshot = null;
  }

  function scheduleFromTransition(transition) {
    clear();
    const state = transition?.state || transition;
    const delay = spellingAutoAdvanceDelay(state);
    if (delay == null || typeof setTimeoutFn !== 'function' || typeof getState !== 'function' || typeof dispatchContinue !== 'function') {
      return false;
    }
    const appState = getState();
    pendingSnapshot = snapshotFromState(state, appState);
    pendingHandle = setTimeoutFn(() => {
      const snapshot = pendingSnapshot;
      pendingHandle = null;
      pendingSnapshot = null;
      if (!stillMatches(snapshot, getState())) return;
      dispatchContinue();
    }, delay);
    return true;
  }

  return {
    clear,
    scheduleFromTransition,
  };
}
