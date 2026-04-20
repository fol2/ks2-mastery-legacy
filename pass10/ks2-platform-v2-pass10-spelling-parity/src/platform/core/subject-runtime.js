const TAB_LABELS = {
  practice: 'Practice',
  analytics: 'Analytics',
  profiles: 'Profiles',
  settings: 'Settings',
  method: 'Method',
  dashboard: 'Dashboard',
};

function runtimeKey({ learnerId, subjectId, tab }) {
  return `${learnerId || 'unknown'}::${subjectId || 'unknown'}::${tab || 'practice'}`;
}

export function subjectTabLabel(tab = 'practice') {
  return TAB_LABELS[tab] || 'Practice';
}

export function formatSubjectRuntimeMessage(subjectName, { phase = 'render', tab = 'practice' } = {}) {
  const tabLabel = subjectTabLabel(tab);
  if (phase === 'action') {
    return `${subjectName} hit an error while handling the last action on the ${tabLabel} tab. The rest of the app is still available, and the last saved subject state was left intact.`;
  }
  if (phase === 'dashboard-stats') {
    return `${subjectName} could not build its dashboard summary right now. The rest of the dashboard is still available.`;
  }
  return `${subjectName} could not render the ${tabLabel} tab right now. The rest of the app is still available.`;
}

export function createSubjectRuntimeBoundary({ now = () => Date.now(), onError } = {}) {
  const entries = new Map();

  function capture({ learnerId, subject, subjectId, tab = 'practice', phase = 'render', methodName = '', action = '', error }) {
    const resolvedSubjectId = subjectId || subject?.id || 'unknown';
    const resolvedSubjectName = subject?.name || resolvedSubjectId;
    const entry = {
      learnerId: learnerId || null,
      subjectId: resolvedSubjectId,
      subjectName: resolvedSubjectName,
      tab,
      phase,
      methodName,
      action,
      debugMessage: error?.message || String(error || 'Unknown error'),
      message: formatSubjectRuntimeMessage(resolvedSubjectName, { phase, tab }),
      capturedAt: now(),
    };
    entries.set(runtimeKey(entry), entry);
    try {
      onError?.(entry, error);
    } catch {
      // boundary logging must never throw back into the shell
    }
    return entry;
  }

  function read({ learnerId, subjectId, tab = 'practice' }) {
    return entries.get(runtimeKey({ learnerId, subjectId, tab })) || null;
  }

  function clear({ learnerId, subjectId, tab = null } = {}) {
    let changed = false;
    for (const key of [...entries.keys()]) {
      const entry = entries.get(key);
      if (!entry) continue;
      if (learnerId != null && entry.learnerId !== learnerId) continue;
      if (subjectId != null && entry.subjectId !== subjectId) continue;
      if (tab != null && entry.tab !== tab) continue;
      entries.delete(key);
      changed = true;
    }
    return changed;
  }

  return {
    capture,
    read,
    clear,
    clearLearner(learnerId) {
      return clear({ learnerId });
    },
    clearSubject(learnerId, subjectId) {
      return clear({ learnerId, subjectId });
    },
    clearAll() {
      const changed = entries.size > 0;
      entries.clear();
      return changed;
    },
    list() {
      return [...entries.values()];
    },
  };
}
