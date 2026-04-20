import { createStore } from './platform/core/store.js';
import { SUBJECTS, getSubject } from './platform/core/subject-registry.js';
import { renderApp } from './platform/ui/render.js';
import { safeParseInt } from './platform/core/utils.js';
import { normalisePlatformRole } from './platform/access/roles.js';
import { buildAdminHubReadModel } from './platform/hubs/admin-read-model.js';
import { buildParentHubReadModel } from './platform/hubs/parent-read-model.js';
import { createLocalPlatformRepositories } from './platform/core/repositories/index.js';
import { createSubjectRuntimeBoundary } from './platform/core/subject-runtime.js';
import { createEventRuntime, createPracticeStreakSubscriber } from './platform/events/index.js';
import { createBrowserTts } from './subjects/spelling/tts.js';
import { createSpellingService } from './subjects/spelling/service.js';
import { createSpellingPersistence } from './subjects/spelling/repository.js';
import { createLocalSpellingContentRepository } from './subjects/spelling/content/repository.js';
import { createSpellingContentService } from './subjects/spelling/content/service.js';
import { createSpellingRewardSubscriber } from './subjects/spelling/event-hooks.js';
import { createSpellingAutoAdvanceController } from './subjects/spelling/auto-advance.js';
import { resolveSpellingShortcut } from './subjects/spelling/shortcuts.js';
import {
  exportLearnerSnapshot,
  exportPlatformSnapshot,
  importPlatformSnapshot,
  PLATFORM_EXPORT_KIND_LEARNER,
} from './platform/core/data-transfer.js';

const root = document.getElementById('app');
const repositories = createLocalPlatformRepositories({ storage: globalThis.localStorage });
await repositories.hydrate();

const tts = createBrowserTts();
const spellingContentRepository = createLocalSpellingContentRepository({ storage: globalThis.localStorage });
const spellingContent = createSpellingContentService({ repository: spellingContentRepository });
const services = {
  spelling: null,
};
let shellPlatformRole = 'parent';

function buildLocalHubModels(appState) {
  const runtimeSnapshot = spellingContent.getRuntimeSnapshot();
  const selectedLearnerId = appState.learners.selectedId;
  const selectedLearner = selectedLearnerId ? appState.learners.byId[selectedLearnerId] : null;

  const learnerBundles = Object.fromEntries(appState.learners.allIds.map((learnerId) => [
    learnerId,
    {
      subjectStates: repositories.subjectStates.readForLearner(learnerId),
      practiceSessions: repositories.practiceSessions.list(learnerId),
      gameState: repositories.gameState.readForLearner(learnerId),
      eventLog: repositories.eventLog.list(learnerId),
    },
  ]));

  const parentHub = selectedLearner
    ? buildParentHubReadModel({
      learner: selectedLearner,
      platformRole: shellPlatformRole,
      membershipRole: 'owner',
      subjectStates: learnerBundles[selectedLearnerId]?.subjectStates || {},
      practiceSessions: learnerBundles[selectedLearnerId]?.practiceSessions || [],
      eventLog: learnerBundles[selectedLearnerId]?.eventLog || [],
      gameState: learnerBundles[selectedLearnerId]?.gameState || {},
      runtimeSnapshots: { spelling: runtimeSnapshot },
      now: Date.now,
    })
    : null;

  const adminHub = buildAdminHubReadModel({
    account: {
      id: 'local-browser',
      selectedLearnerId,
      repoRevision: 0,
      platformRole: shellPlatformRole,
    },
    platformRole: shellPlatformRole,
    spellingContentBundle: spellingContent.readBundle(),
    memberships: appState.learners.allIds.map((learnerId, index) => ({
      learnerId,
      role: 'owner',
      sortIndex: index,
      stateRevision: 0,
      learner: appState.learners.byId[learnerId],
    })),
    learnerBundles,
    runtimeSnapshots: { spelling: runtimeSnapshot },
    auditEntries: [],
    auditAvailable: false,
    selectedLearnerId,
    now: Date.now,
  });

  return {
    shellAccess: {
      platformRole: shellPlatformRole,
      source: 'local-reference',
    },
    parentHub,
    adminHub,
  };
}

function rebuildSpellingService() {
  services.spelling = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts,
    contentSnapshot: spellingContent.getRuntimeSnapshot(),
  });
  return services.spelling;
}

rebuildSpellingService();

const runtimeBoundary = createSubjectRuntimeBoundary({
  onError(entry, error) {
    globalThis.console?.error?.(`Subject runtime containment hit ${entry.subjectId}:${entry.tab}:${entry.phase}.`, error);
  },
});

const eventRuntime = createEventRuntime({
  repositories,
  subscribers: [
    createPracticeStreakSubscriber(),
    createSpellingRewardSubscriber({ gameStateRepository: repositories.gameState }),
  ],
  onError(error) {
    globalThis.console?.error?.('Reward/event subscriber failed.', error);
  },
});

function resetLearnerData(learnerId) {
  Object.values(services).forEach((service) => {
    service?.resetLearner?.(learnerId);
  });
  repositories.subjectStates.clearLearner(learnerId);
  repositories.practiceSessions.clearLearner(learnerId);
  repositories.gameState.clearLearner(learnerId);
  repositories.eventLog.clearLearner(learnerId);
}

function sanitiseFilenamePart(value, fallback = 'learner') {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || fallback;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleImportFileChange(input) {
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const isLearnerImport = parsed?.kind === PLATFORM_EXPORT_KIND_LEARNER;
    if (!isLearnerImport) {
      const confirmed = globalThis.confirm('Importing full app data will replace the current browser dataset. Continue?');
      if (!confirmed) return;
    }
    const result = importPlatformSnapshot(repositories, parsed);
    runtimeBoundary.clearAll();
    store.reloadFromRepositories();
    tts.stop();
    if (result.kind === 'learner') {
      const message = result.renamed
        ? 'Learner imported as a copy because that learner id already existed.'
        : 'Learner imported successfully.';
      globalThis.alert(message);
    } else {
      globalThis.alert('App data imported successfully.');
    }
  } catch (error) {
    globalThis.alert(`Import failed: ${error?.message || 'Unknown error.'}`);
  } finally {
    input.value = '';
  }
}

function refreshSpellingRuntimeAfterContentChange() {
  tts.stop();
  rebuildSpellingService();
  const appState = store.getState();
  const learnerId = appState.learners.selectedId;
  store.updateSubjectUi('spelling', services.spelling.initState(appState.subjectUi.spelling, learnerId));
}

async function handleSpellingContentImportFileChange(input) {
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    spellingContent.importPortable(parsed);
    refreshSpellingRuntimeAfterContentChange();
    globalThis.alert('Spelling content imported successfully.');
  } catch (error) {
    const validationCount = Number(error?.validation?.errors?.length) || 0;
    const suffix = validationCount ? ` (${validationCount} validation errors)` : '';
    globalThis.alert(`Spelling content import failed${suffix}: ${error?.message || 'Unknown error.'}`);
  } finally {
    input.value = '';
  }
}

const store = createStore(SUBJECTS, { repositories });

const spellingAutoAdvance = createSpellingAutoAdvanceController({
  getState: () => store.getState(),
  dispatchContinue: () => dispatchAction('spelling-continue'),
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
  if (subjectId === 'spelling') spellingAutoAdvance.scheduleFromTransition(transition);
  return true;
}

function contextFor(subjectId = null) {
  const appState = store.getState();
  const resolvedSubject = subjectId ? getSubject(subjectId) : getSubject(appState.route.subjectId || 'spelling');
  return {
    appState,
    store,
    services,
    repositories,
    subject: resolvedSubject,
    service: services[resolvedSubject.id] || null,
    spellingContent,
    tts,
    applySubjectTransition,
    runtimeBoundary,
    ...buildLocalHubModels(appState),
  };
}

function render() {
  const appState = store.getState();
  root.innerHTML = renderApp(appState, contextFor(appState.route.subjectId || 'spelling'));
  queueMicrotask(() => {
    const input = root.querySelector('[data-autofocus="true"]:not([disabled])');
    if (input) input.focus();
  });
}

store.subscribe(render);
render();

function handleGlobalAction(action, data) {
  const appState = store.getState();
  const learnerId = appState.learners.selectedId;
  const learner = appState.learners.byId[learnerId];

  if (action === 'navigate-home') {
    tts.stop();
    store.goHome();
    return true;
  }

  if (action === 'open-subject') {
    tts.stop();
    store.openSubject(data.subjectId || 'spelling', data.tab || 'practice');
    return true;
  }

  if (action === 'open-parent-hub') {
    tts.stop();
    store.openParentHub();
    return true;
  }

  if (action === 'open-admin-hub') {
    tts.stop();
    store.openAdminHub();
    return true;
  }

  if (action === 'shell-set-role') {
    shellPlatformRole = normalisePlatformRole(data.value);
    store.patch(() => ({}));
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
      name: `Learner ${appState.learners.allIds.length + 1}`,
      yearGroup: current?.yearGroup || 'Y5',
      goal: current?.goal || 'sats',
      dailyMinutes: current?.dailyMinutes || 15,
      avatarColor: current?.avatarColor || '#3E6FA8',
    });
    return true;
  }

  if (action === 'learner-save-form') {
    const formData = data.formData;
    store.updateLearner(learnerId, {
      name: String(formData.get('name') || 'Learner').trim() || 'Learner',
      yearGroup: String(formData.get('yearGroup') || 'Y5'),
      goal: String(formData.get('goal') || 'sats'),
      dailyMinutes: safeParseInt(formData.get('dailyMinutes'), 15),
      avatarColor: String(formData.get('avatarColor') || '#3E6FA8'),
    });
    return true;
  }

  if (action === 'learner-delete') {
    if (!globalThis.confirm('Delete the current learner and all their subject progress and codex state?')) return true;
    runtimeBoundary.clearLearner(learnerId);
    resetLearnerData(learnerId);
    store.deleteLearner(learnerId);
    return true;
  }

  if (action === 'learner-reset-progress') {
    if (!globalThis.confirm('Reset subject progress and codex rewards for the current learner?')) return true;
    tts.stop();
    runtimeBoundary.clearLearner(learnerId);
    resetLearnerData(learnerId);
    store.resetSubjectUi();
    return true;
  }

  if (action === 'platform-reset-all') {
    if (!globalThis.confirm('Reset all app data for every learner on this browser?')) return true;
    tts.stop();
    runtimeBoundary.clearAll();
    store.clearAllProgress();
    globalThis.location.reload();
    return true;
  }

  if (action === 'platform-export-learner') {
    const payload = exportLearnerSnapshot(repositories, learnerId);
    downloadJson(`${sanitiseFilenamePart(learner?.name)}-ks2-platform-learner.json`, payload);
    return true;
  }

  if (action === 'platform-export-app') {
    const payload = exportPlatformSnapshot(repositories);
    downloadJson('ks2-platform-data.json', payload);
    return true;
  }

  if (action === 'platform-import') {
    const input = root.querySelector('#platform-import-file');
    input?.click();
    return true;
  }

  if (action === 'spelling-content-export') {
    downloadJson('ks2-spelling-content.json', spellingContent.exportPortable());
    return true;
  }

  if (action === 'spelling-content-import') {
    const input = root.querySelector('#spelling-content-import-file');
    input?.click();
    return true;
  }

  if (action === 'spelling-content-publish') {
    const validation = spellingContent.validate();
    if (!validation.ok) {
      globalThis.alert(`Cannot publish spelling content while ${validation.errors.length} validation error(s) remain.`);
      return true;
    }
    spellingContent.publishDraft({ notes: 'Published from the in-app operator hook.' });
    refreshSpellingRuntimeAfterContentChange();
    globalThis.alert('Spelling content published as a new release.');
    return true;
  }

  if (action === 'spelling-content-reset') {
    if (!globalThis.confirm('Reset spelling content to the bundled published baseline?')) return true;
    spellingContent.resetToSeeded();
    refreshSpellingRuntimeAfterContentChange();
    globalThis.alert('Spelling content reset to the bundled baseline.');
    return true;
  }

  if (action === 'toast-dismiss') {
    store.dismissToast(Number(data.index));
    return true;
  }

  if (action === 'persistence-retry') {
    repositories.persistence.retry().catch((error) => {
      globalThis.console?.warn?.('Persistence retry failed.', error);
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

  return false;
}

function handleSubjectAction(action, data) {
  const appState = store.getState();
  const learnerId = appState.learners.selectedId;
  const tab = appState.route.tab || 'practice';
  const subject = getSubject(appState.route.subjectId || 'spelling');

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

function dispatchAction(action, data = {}) {
  spellingAutoAdvance.clear();
  if (handleGlobalAction(action, data)) return;
  handleSubjectAction(action, data);
}

function extractActionData(target) {
  return {
    action: target.dataset.action,
    subjectId: target.dataset.subjectId,
    tab: target.dataset.tab,
    pref: target.dataset.pref,
    slug: target.dataset.slug,
    index: target.dataset.index,
    value: target.value,
    checked: target.checked,
  };
}

root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;
  if (target.tagName === 'FORM') return;
  event.preventDefault();
  dispatchAction(action, extractActionData(target));
});

root.addEventListener('change', (event) => {
  const fileInput = event.target.closest('#platform-import-file');
  if (fileInput) {
    handleImportFileChange(fileInput);
    return;
  }

  const spellingContentInput = event.target.closest('#spelling-content-import-file');
  if (spellingContentInput) {
    handleSpellingContentImportFileChange(spellingContentInput);
    return;
  }

  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;
  if (!['SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName)) return;
  dispatchAction(action, extractActionData(target));
});

root.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  event.preventDefault();
  dispatchAction(form.dataset.action, {
    formData: new FormData(form),
  });
});

globalThis.addEventListener?.('keydown', (event) => {
  const shortcut = resolveSpellingShortcut(event, store.getState());
  if (!shortcut) return;
  if (shortcut.preventDefault) event.preventDefault();
  if (shortcut.focusSelector) {
    const input = root.querySelector(shortcut.focusSelector);
    if (input) {
      input.focus();
      input.select?.();
    }
    return;
  }
  if (!shortcut.action) return;
  dispatchAction(shortcut.action, shortcut.data || {});
});
