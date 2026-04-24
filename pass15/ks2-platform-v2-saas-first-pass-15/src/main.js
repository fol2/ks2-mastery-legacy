import { createStore } from './platform/core/store.js';
import { SUBJECTS, getSubject } from './platform/core/subject-registry.js';
import { renderApp } from './platform/ui/render.js';
import { safeParseInt, uid } from './platform/core/utils.js';
import { shouldDispatchClickAction } from './platform/core/dom-actions.js';
import { normalisePlatformRole } from './platform/access/roles.js';
import {
  hasWritableLearnerSnapshot,
  resolveSignedInZeroWritableHome,
  zeroWritableSubjectRedirectMessage,
} from './platform/access/zero-writable-shell.js';
import { buildAdminHubReadModel } from './platform/hubs/admin-read-model.js';
import { createHubApi } from './platform/hubs/api.js';
import { buildParentHubReadModel } from './platform/hubs/parent-read-model.js';
import {
  buildAdminHubAccessContext,
  buildParentHubAccessContext,
  readOnlyLearnerActionBlockReason,
} from './platform/hubs/shell-access.js';
import {
  createApiPlatformRepositories,
  createLocalPlatformRepositories,
} from './platform/core/repositories/index.js';
import { createSubjectRuntimeBoundary } from './platform/core/subject-runtime.js';
import { createEventRuntime, createPracticeStreakSubscriber } from './platform/events/index.js';
import { createPlatformTts } from './subjects/spelling/tts.js';
import { createSpellingService } from './subjects/spelling/service.js';
import { createSpellingPersistence } from './subjects/spelling/repository.js';
import {
  createApiSpellingContentRepository,
  createLocalSpellingContentRepository,
} from './subjects/spelling/content/repository.js';
import { createSpellingContentService } from './subjects/spelling/content/service.js';
import { createSpellingRewardSubscriber } from './subjects/spelling/event-hooks.js';
import { createSpellingAutoAdvanceController } from './subjects/spelling/auto-advance.js';
import { resolveSpellingShortcut } from './subjects/spelling/shortcuts.js';
import {
  exportLearnerSnapshot,
  exportPlatformSnapshot,
  importPlatformSnapshot,
  LEGACY_SPELLING_EXPORT_KIND,
  PLATFORM_EXPORT_KIND_LEARNER,
} from './platform/core/data-transfer.js';

const root = document.getElementById('app');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLocalMode() {
  const params = new URLSearchParams(globalThis.location.search);
  return globalThis.location.protocol === 'file:' || params.get('local') === '1';
}

function credentialFetch(input, init = {}) {
  return fetch(input, {
    ...init,
    credentials: 'same-origin',
  });
}

async function readCurrentWorkerSession() {
  const response = await credentialFetch('/api/session', {
    headers: { accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || 'Could not read the current signed-in session.');
  }
  return payload;
}

function renderAuthScreen({ mode = 'login', error = '' } = {}) {
  const isRegister = mode === 'register';
  root.innerHTML = `
    <main class="auth-shell">
      <section class="auth-panel card">
        <div class="eyebrow">KS2 Mastery</div>
        <h1 class="title">${isRegister ? 'Create your parent account' : 'Sign in to continue'}</h1>
        <p class="subtitle">Your learner profiles and spelling progress sync through the KS2 Mastery cloud backend.</p>
        ${error ? `<div class="feedback bad" style="margin-top:16px;">${escapeHtml(error)}</div>` : ''}
        <form class="auth-form" data-auth-action="${isRegister ? 'register' : 'login'}">
          <label class="field">
            <span>Email</span>
            <input class="input" type="email" name="email" autocomplete="email" required />
          </label>
          <label class="field">
            <span>Password</span>
            <input class="input" type="password" name="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" minlength="8" required />
          </label>
          <button class="btn primary lg" style="background:#3E6FA8;" type="submit">${isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <div class="auth-switch">
          <button class="btn ghost" data-auth-mode="${isRegister ? 'login' : 'register'}">${isRegister ? 'Use an existing account' : 'Create a new account'}</button>
        </div>
        <div class="auth-divider"><span>Social sign-in</span></div>
        <div class="auth-social">
          ${['google', 'facebook', 'x', 'apple'].map((provider) => `
            <button class="btn secondary" data-auth-provider="${provider}">${provider === 'x' ? 'X' : provider[0].toUpperCase() + provider.slice(1)}</button>
          `).join('')}
        </div>
      </section>
    </main>
  `;
}

async function submitAuthForm(form) {
  const action = form.dataset.authAction === 'register' ? 'register' : 'login';
  const formData = new FormData(form);
  const response = await credentialFetch(`/api/auth/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: formData.get('email'),
      password: formData.get('password'),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    renderAuthScreen({ mode: action, error: payload.message || 'Sign-in failed.' });
    return;
  }
  globalThis.location.href = '/';
}

async function startSocialAuth(provider) {
  const response = await credentialFetch(`/api/auth/${provider}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.redirectUrl) {
    renderAuthScreen({ error: payload.message || 'That sign-in provider is not configured yet.' });
    return;
  }
  globalThis.location.href = payload.redirectUrl;
}

let authScreenBound = false;

function bindAuthScreen() {
  if (authScreenBound) return;
  authScreenBound = true;
  root.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-auth-mode]');
    if (modeButton) {
      event.preventDefault();
      renderAuthScreen({ mode: modeButton.dataset.authMode });
      bindAuthScreen();
      return;
    }

    const providerButton = event.target.closest('[data-auth-provider]');
    if (providerButton) {
      event.preventDefault();
      startSocialAuth(providerButton.dataset.authProvider).catch((error) => {
        renderAuthScreen({ error: error?.message || 'Could not start social sign-in.' });
      });
    }
  });

  root.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-auth-action]');
    if (!form) return;
    event.preventDefault();
    submitAuthForm(form).catch((error) => {
      renderAuthScreen({ mode: form.dataset.authAction, error: error?.message || 'Sign-in failed.' });
    });
  });
}

async function createRepositoriesForCurrentRuntime() {
  if (isLocalMode()) {
    const localRepositories = createLocalPlatformRepositories({ storage: globalThis.localStorage });
    return {
      repositories: localRepositories,
      session: { signedIn: false, mode: 'local-only', platformRole: 'parent' },
    };
  }

  const sessionResponse = await credentialFetch('/api/auth/session', {
    headers: { accept: 'application/json' },
  });
  const sessionPayload = await sessionResponse.json().catch(() => null);

  if (!sessionResponse.ok || !sessionPayload?.session?.accountId) {
    const params = new URLSearchParams(globalThis.location.search);
    renderAuthScreen({ error: params.get('auth_error') || '' });
    bindAuthScreen();
    await new Promise(() => {});
  }

  const accountId = sessionPayload?.session?.accountId || 'unknown';
  const apiRepositories = createApiPlatformRepositories({
    baseUrl: '',
    fetch: credentialFetch,
    cacheScopeKey: `account:${accountId}`,
  });

  return {
    repositories: apiRepositories,
    session: {
      signedIn: true,
      mode: 'remote-sync',
      accountId,
      email: sessionPayload?.session?.email || '',
      provider: sessionPayload?.session?.provider || 'session',
      platformRole: normalisePlatformRole(
        sessionPayload?.account?.platformRole || sessionPayload?.session?.platformRole,
      ),
      repoRevision: Number(sessionPayload?.account?.repoRevision) || 0,
    },
  };
}

const boot = await createRepositoriesForCurrentRuntime();
const repositories = boot.repositories;
globalThis.KS2_AUTH_SESSION = boot.session;
await repositories.hydrate();

const tts = createPlatformTts({ fetchFn: credentialFetch });
const spellingContentRepository = boot.session.signedIn
  ? createApiSpellingContentRepository({ baseUrl: '', fetch: credentialFetch })
  : createLocalSpellingContentRepository({ storage: globalThis.localStorage });
const spellingContent = createSpellingContentService({ repository: spellingContentRepository });
await spellingContent.hydrate();
const services = {
  spelling: null,
};
let shellPlatformRole = normalisePlatformRole(boot.session.platformRole || 'parent');
let adminAccountDirectory = {
  status: 'idle',
  accounts: [],
  currentAccount: null,
  error: '',
  savingAccountId: '',
};
const hubApi = boot.session.signedIn
  ? createHubApi({ baseUrl: '', fetch: credentialFetch })
  : null;

function createHubLoadState() {
  return {
    status: 'idle',
    learnerId: '',
    payload: null,
    error: '',
    errorCode: '',
    statusCode: 0,
    requestToken: 0,
  };
}

function createZeroWritableShellState() {
  return {
    status: 'idle',
    mode: 'resolving',
    notice: '',
    error: '',
    submitting: false,
    requestToken: 0,
    form: {
      name: '',
      yearGroup: 'Y5',
    },
  };
}

let adultSurfaceState = {
  selectedLearnerId: '',
  notice: '',
  parentHub: createHubLoadState(),
  adminHub: createHubLoadState(),
};
let zeroWritableState = createZeroWritableShellState();

function patchAdultSurfaceState(updater, { rerender = true } = {}) {
  adultSurfaceState = typeof updater === 'function'
    ? updater(adultSurfaceState)
    : { ...adultSurfaceState, ...(updater || {}) };
  if (rerender) store.patch(() => ({}));
  return adultSurfaceState;
}

function patchAdultHubEntry(entryKey, patch, { rerender = true } = {}) {
  return patchAdultSurfaceState((current) => ({
    ...current,
    [entryKey]: {
      ...current[entryKey],
      ...(patch || {}),
    },
  }), { rerender });
}

function setAdultSurfaceNotice(message, { rerender = true } = {}) {
  patchAdultSurfaceState({ notice: message || '' }, { rerender });
}

function clearAdultSurfaceNotice({ rerender = false } = {}) {
  if (!adultSurfaceState.notice) return;
  patchAdultSurfaceState({ notice: '' }, { rerender });
}

function patchZeroWritableState(updater, { rerender = true } = {}) {
  zeroWritableState = typeof updater === 'function'
    ? updater(zeroWritableState)
    : { ...zeroWritableState, ...(updater || {}) };
  if (rerender) store.patch(() => ({}));
  return zeroWritableState;
}

function resetZeroWritableState({ rerender = false } = {}) {
  zeroWritableState = createZeroWritableShellState();
  if (rerender) store.patch(() => ({}));
  return zeroWritableState;
}

function clearZeroWritableNotice({ rerender = false } = {}) {
  if (!zeroWritableState.notice) return;
  patchZeroWritableState({ notice: '' }, { rerender });
}

function hasWritableLearnerInShell(appState = store.getState()) {
  return hasWritableLearnerSnapshot(appState);
}

function invalidateAdultHubState(entryKey = null, { rerender = false } = {}) {
  if (!entryKey) {
    patchAdultSurfaceState((current) => ({
      ...current,
      parentHub: createHubLoadState(),
      adminHub: createHubLoadState(),
    }), { rerender });
    return;
  }
  patchAdultHubEntry(entryKey, createHubLoadState(), { rerender });
}

function preferredAdultLearnerId(explicitLearnerId = null) {
  const explicit = typeof explicitLearnerId === 'string' && explicitLearnerId ? explicitLearnerId : '';
  if (explicit) return explicit;
  if (adultSurfaceState.selectedLearnerId) return adultSurfaceState.selectedLearnerId;
  const appState = store.getState();
  return appState.learners.selectedId || null;
}

function resolveAdultPayloadLearnerId(entryKey, payload) {
  if (entryKey === 'parentHub') {
    return payload?.learnerId || payload?.parentHub?.selectedLearnerId || payload?.parentHub?.learner?.id || '';
  }
  return payload?.adminHub?.learnerSupport?.selectedLearnerId || payload?.adminHub?.account?.selectedLearnerId || '';
}

function syncWritableLearnerSelection(learnerId) {
  if (!learnerId) return false;
  const appState = store.getState();
  if (!appState.learners.byId[learnerId]) return false;
  if (appState.learners.selectedId === learnerId) return false;
  tts.stop();
  runtimeBoundary.clearAll();
  store.selectLearner(learnerId);
  return true;
}

function resolveActiveAdultAccessContext(appState) {
  if (!boot.session.signedIn) return null;
  if (appState.route.screen === 'parent-hub') {
    return buildParentHubAccessContext(adultSurfaceState.parentHub.payload, appState.learners.selectedId);
  }
  if (appState.route.screen === 'admin-hub') {
    return buildAdminHubAccessContext(adultSurfaceState.adminHub.payload, appState.learners.selectedId);
  }
  return null;
}

function blockedReadOnlyAdultActionReason(action) {
  return readOnlyLearnerActionBlockReason(action, resolveActiveAdultAccessContext(store.getState()));
}

function blockReadOnlyAdultAction(action) {
  const reason = blockedReadOnlyAdultActionReason(action);
  if (!reason) return false;
  setAdultSurfaceNotice(reason);
  return true;
}

async function loadParentHub({ learnerId = null, force = false } = {}) {
  if (!hubApi) return null;
  const requestedLearnerId = preferredAdultLearnerId(learnerId);
  const cacheKey = requestedLearnerId || '';
  const current = adultSurfaceState.parentHub;
  if (!force && current.status === 'loading' && current.learnerId === cacheKey) return current.payload;
  if (!force && current.status === 'loaded' && current.payload && current.learnerId === cacheKey) return current.payload;
  if (!force && current.status === 'error' && current.learnerId === cacheKey) return null;

  const requestToken = (Number(current.requestToken) || 0) + 1;
  patchAdultSurfaceState((state) => ({
    ...state,
    notice: '',
    parentHub: {
      status: 'loading',
      learnerId: cacheKey,
      payload: null,
      error: '',
      errorCode: '',
      statusCode: 0,
      requestToken,
    },
  }));

  try {
    const payload = await hubApi.readParentHub(requestedLearnerId);
    if (adultSurfaceState.parentHub.requestToken !== requestToken) return payload;
    const resolvedLearnerId = resolveAdultPayloadLearnerId('parentHub', payload) || cacheKey;
    adultSurfaceState = {
      ...adultSurfaceState,
      selectedLearnerId: resolvedLearnerId || adultSurfaceState.selectedLearnerId,
      notice: '',
      parentHub: {
        status: 'loaded',
        learnerId: resolvedLearnerId,
        payload,
        error: '',
        errorCode: '',
        statusCode: 200,
        requestToken,
      },
    };
    const syncedWritableShell = syncWritableLearnerSelection(resolvedLearnerId);
    if (!syncedWritableShell) store.patch(() => ({}));
    return payload;
  } catch (error) {
    if (adultSurfaceState.parentHub.requestToken !== requestToken) return null;
    patchAdultSurfaceState((state) => ({
      ...state,
      parentHub: {
        status: 'error',
        learnerId: cacheKey,
        payload: null,
        error: error?.message || 'Could not load Parent Hub.',
        errorCode: error?.code || '',
        statusCode: Number(error?.status) || 0,
        requestToken,
      },
    }));
    return null;
  }
}

async function loadAdminHub({ learnerId = null, force = false, auditLimit = 20 } = {}) {
  if (!hubApi) return null;
  const requestedLearnerId = preferredAdultLearnerId(learnerId);
  const cacheKey = requestedLearnerId || '';
  const current = adultSurfaceState.adminHub;
  if (!force && current.status === 'loading' && current.learnerId === cacheKey) return current.payload;
  if (!force && current.status === 'loaded' && current.payload && current.learnerId === cacheKey) return current.payload;
  if (!force && current.status === 'error' && current.learnerId === cacheKey) return null;

  const requestToken = (Number(current.requestToken) || 0) + 1;
  patchAdultSurfaceState((state) => ({
    ...state,
    notice: '',
    adminHub: {
      status: 'loading',
      learnerId: cacheKey,
      payload: null,
      error: '',
      errorCode: '',
      statusCode: 0,
      requestToken,
    },
  }));

  try {
    const payload = await hubApi.readAdminHub({ learnerId: requestedLearnerId, auditLimit });
    if (adultSurfaceState.adminHub.requestToken !== requestToken) return payload;
    const resolvedLearnerId = resolveAdultPayloadLearnerId('adminHub', payload) || cacheKey;
    adultSurfaceState = {
      ...adultSurfaceState,
      selectedLearnerId: resolvedLearnerId || adultSurfaceState.selectedLearnerId,
      notice: '',
      adminHub: {
        status: 'loaded',
        learnerId: resolvedLearnerId,
        payload,
        error: '',
        errorCode: '',
        statusCode: 200,
        requestToken,
      },
    };
    const syncedWritableShell = syncWritableLearnerSelection(resolvedLearnerId);
    if (!syncedWritableShell) store.patch(() => ({}));
    return payload;
  } catch (error) {
    if (adultSurfaceState.adminHub.requestToken !== requestToken) return null;
    patchAdultSurfaceState((state) => ({
      ...state,
      adminHub: {
        status: 'error',
        learnerId: cacheKey,
        payload: null,
        error: error?.message || 'Could not load Admin / Operations.',
        errorCode: error?.code || '',
        statusCode: Number(error?.status) || 0,
        requestToken,
      },
    }));
    return null;
  }
}

function currentZeroWritableOutcome() {
  return resolveSignedInZeroWritableHome({
    platformRole: shellPlatformRole,
    parentHubPayload: adultSurfaceState.parentHub.payload,
    parentHubErrorCode: adultSurfaceState.parentHub.errorCode,
    parentHubStatusCode: adultSurfaceState.parentHub.statusCode,
  });
}

async function routeSignedInZeroWritableHome({ notice = '', force = false } = {}) {
  if (!boot.session.signedIn) return false;
  if (hasWritableLearnerInShell()) {
    resetZeroWritableState({ rerender: false });
    return false;
  }

  const requestToken = (Number(zeroWritableState.requestToken) || 0) + 1;
  const baseForm = zeroWritableState.form && typeof zeroWritableState.form === 'object'
    ? zeroWritableState.form
    : { name: '', yearGroup: 'Y5' };

  patchZeroWritableState({
    status: 'resolving',
    mode: 'resolving',
    notice: notice || '',
    error: '',
    submitting: false,
    requestToken,
    form: {
      name: typeof baseForm.name === 'string' ? baseForm.name : '',
      yearGroup: typeof baseForm.yearGroup === 'string' ? baseForm.yearGroup : 'Y5',
    },
  }, { rerender: false });

  store.openZeroWritable();

  const resolvedPlatformRole = normalisePlatformRole(shellPlatformRole);
  if (resolvedPlatformRole === 'admin' || resolvedPlatformRole === 'ops') {
    resetZeroWritableState({ rerender: false });
    if (notice) setAdultSurfaceNotice(notice, { rerender: false });
    else clearAdultSurfaceNotice({ rerender: false });
    store.openAdminHub();
    loadAdminHub({ force: true });
    loadAdminAccounts();
    return true;
  }

  await loadParentHub({ force });
  if (zeroWritableState.requestToken !== requestToken) return true;

  const outcome = currentZeroWritableOutcome();
  if (outcome.screen === 'parent-hub') {
    resetZeroWritableState({ rerender: false });
    if (notice) setAdultSurfaceNotice(notice, { rerender: false });
    else clearAdultSurfaceNotice({ rerender: false });
    store.openParentHub();
    return true;
  }

  if (outcome.mode === 'create-first-learner') {
    clearAdultSurfaceNotice({ rerender: false });
    patchZeroWritableState((current) => ({
      ...current,
      status: 'onboarding',
      mode: 'create-first-learner',
      notice: notice || '',
      error: '',
      submitting: false,
      requestToken,
    }), { rerender: true });
    store.openZeroWritable();
    return true;
  }

  clearAdultSurfaceNotice({ rerender: false });
  patchZeroWritableState((current) => ({
    ...current,
    status: outcome.mode === 'resolving' ? 'resolving' : 'error',
    mode: outcome.mode,
    notice: notice || '',
    error: adultSurfaceState.parentHub.error || 'Signed-in home could not be resolved.',
    submitting: false,
    requestToken,
  }), { rerender: true });
  store.openZeroWritable();
  return true;
}

function routeHomeForCurrentAccount({ notice = '', force = false } = {}) {
  if (!boot.session.signedIn || hasWritableLearnerInShell()) {
    resetZeroWritableState({ rerender: false });
    store.goHome();
    return true;
  }
  routeSignedInZeroWritableHome({ notice, force }).catch((error) => {
    patchZeroWritableState((current) => ({
      ...current,
      status: 'error',
      mode: 'error',
      notice: notice || current.notice || '',
      error: error?.message || 'Signed-in home could not be resolved.',
      submitting: false,
    }), { rerender: true });
    store.openZeroWritable();
  });
  return true;
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

function learnerReadBundle(learnerId) {
  return {
    subjectStates: repositories.subjectStates.readForLearner(learnerId),
    practiceSessions: repositories.practiceSessions.list(learnerId),
    gameState: repositories.gameState.readForLearner(learnerId),
    eventLog: repositories.eventLog.list(learnerId),
  };
}

function buildLocalHubModels(appState) {
  const runtimeSnapshot = spellingContent.getRuntimeSnapshot();
  const selectedLearnerId = appState.learners.selectedId;
  const selectedLearner = selectedLearnerId ? appState.learners.byId[selectedLearnerId] : null;
  const learnerBundles = Object.fromEntries(appState.learners.allIds.map((learnerId) => [
    learnerId,
    learnerReadBundle(learnerId),
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
      id: boot.session.accountId || 'local-browser',
      selectedLearnerId,
      repoRevision: Number(boot.session.repoRevision) || 0,
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
    parentHubState: { status: 'loaded', learnerId: selectedLearnerId || '', error: '', notice: '' },
    adminHub,
    adminHubState: { status: 'loaded', learnerId: selectedLearnerId || '', error: '', notice: '' },
    activeAdultLearnerContext: null,
    adultSurfaceNotice: '',
    zeroWritableState,
    adminAccountDirectory,
  };
}

function buildSignedInHubModels(appState) {
  const parentHubState = {
    status: adultSurfaceState.parentHub.status,
    learnerId: adultSurfaceState.parentHub.learnerId || '',
    error: adultSurfaceState.parentHub.error || '',
    notice: adultSurfaceState.notice || '',
  };
  const adminHubState = {
    status: adultSurfaceState.adminHub.status,
    learnerId: adultSurfaceState.adminHub.learnerId || '',
    error: adultSurfaceState.adminHub.error || '',
    notice: adultSurfaceState.notice || '',
  };

  return {
    shellAccess: {
      platformRole: shellPlatformRole,
      source: 'worker-session',
    },
    parentHub: adultSurfaceState.parentHub.payload?.parentHub || null,
    parentHubState,
    adminHub: adultSurfaceState.adminHub.payload?.adminHub || null,
    adminHubState,
    activeAdultLearnerContext: resolveActiveAdultAccessContext(appState),
    adultSurfaceNotice: adultSurfaceState.notice || '',
    zeroWritableState,
    adminAccountDirectory,
  };
}

function buildHubModels(appState) {
  return boot.session.signedIn ? buildSignedInHubModels(appState) : buildLocalHubModels(appState);
}

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
    const isNonReplacingImport = parsed?.kind === PLATFORM_EXPORT_KIND_LEARNER
      || parsed?.kind === LEGACY_SPELLING_EXPORT_KIND
      || Array.isArray(parsed?.profiles);
    if (!isNonReplacingImport) {
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
    } else if (result.kind === 'legacy-spelling') {
      const count = Number(result.importedCount) || 0;
      globalThis.alert(`Imported ${count} legacy spelling learner profile${count === 1 ? '' : 's'} as new learner copies.`);
    } else {
      globalThis.alert('App data imported successfully.');
    }
  } catch (error) {
    globalThis.alert(`Import failed: ${error?.message || 'Unknown error.'}`);
  } finally {
    input.value = '';
  }
}

async function prepareForSpellingContentMutation() {
  await repositories.persistence.retry();
  await spellingContent.hydrate();
}

async function refreshAfterSpellingContentMutation() {
  tts.stop();
  await repositories.hydrate({
    cacheScope: 'spelling-content-mutation',
    rebasePending: true,
    rebasePayloads: true,
  });
  rebuildSpellingService();
  runtimeBoundary.clearAll();
  store.reloadFromRepositories({ preserveRoute: true });
}

async function handleSpellingContentMutation(operation, successMessage) {
  try {
    await prepareForSpellingContentMutation();
    await operation();
    await refreshAfterSpellingContentMutation();
    if (successMessage) globalThis.alert(successMessage);
  } catch (error) {
    const validationCount = Number(error?.validation?.errors?.length || error?.payload?.validation?.errors?.length) || 0;
    const suffix = validationCount ? ` (${validationCount} validation errors)` : '';
    globalThis.alert(`Spelling content update failed${suffix}: ${error?.message || 'Unknown error.'}`);
  }
}

async function handleSpellingContentImportFileChange(input) {
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await handleSpellingContentMutation(
      () => spellingContent.importPortable(parsed),
      'Spelling content imported successfully.',
    );
  } catch (error) {
    globalThis.alert(`Spelling content import failed: ${error?.message || 'Unknown error.'}`);
  } finally {
    input.value = '';
  }
}

function canLoadAdminAccounts() {
  return boot.session.signedIn && shellPlatformRole === 'admin';
}

function patchAdminAccountDirectory(nextState) {
  adminAccountDirectory = {
    ...adminAccountDirectory,
    ...nextState,
  };
  store.patch(() => ({}));
}

async function loadAdminAccounts({ force = false } = {}) {
  if (!canLoadAdminAccounts()) {
    patchAdminAccountDirectory({
      status: 'unavailable',
      accounts: [],
      currentAccount: null,
      error: 'Account role management requires an admin account.',
      savingAccountId: '',
    });
    return;
  }
  if (!force && ['loading', 'loaded', 'saving'].includes(adminAccountDirectory.status)) return;

  patchAdminAccountDirectory({
    status: 'loading',
    error: '',
    savingAccountId: '',
  });

  try {
    const response = await credentialFetch('/api/admin/accounts', {
      headers: { accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Could not load account roles.');
    patchAdminAccountDirectory({
      status: 'loaded',
      accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
      currentAccount: payload.currentAccount || null,
      error: '',
      savingAccountId: '',
    });

    invalidateAdultHubState(null, { rerender: false });
    const currentScreen = store.getState().route.screen;
    if (currentScreen === 'admin-hub') {
      loadAdminHub({ force: true });
      loadAdminAccounts({ force: true });
    } else if (currentScreen === 'parent-hub') {
      loadParentHub({ force: true });
    }
  } catch (error) {
    patchAdminAccountDirectory({
      status: 'error',
      error: error?.message || 'Could not load account roles.',
      savingAccountId: '',
    });
  }
}

async function updateAdminAccountRole(accountId, platformRole) {
  if (!canLoadAdminAccounts()) {
    patchAdminAccountDirectory({
      status: 'unavailable',
      error: 'Account role management requires an admin account.',
      savingAccountId: '',
    });
    return;
  }

  patchAdminAccountDirectory({
    status: 'saving',
    error: '',
    savingAccountId: accountId,
  });

  try {
    const response = await credentialFetch('/api/admin/accounts/role', {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        platformRole,
        requestId: uid('role-change'),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'Could not update account role.');

    const currentRole = normalisePlatformRole(payload.currentAccount?.platformRole || shellPlatformRole);
    shellPlatformRole = currentRole;
    globalThis.KS2_AUTH_SESSION = {
      ...(globalThis.KS2_AUTH_SESSION || {}),
      platformRole: currentRole,
    };

    patchAdminAccountDirectory({
      status: 'loaded',
      accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
      currentAccount: payload.currentAccount || null,
      error: '',
      savingAccountId: '',
    });
  } catch (error) {
    patchAdminAccountDirectory({
      status: 'error',
      error: error?.message || 'Could not update account role.',
      savingAccountId: '',
    });
  }
}

const store = createStore(SUBJECTS, { repositories });

if (boot.session.signedIn && !hasWritableLearnerInShell(store.getState())) {
  zeroWritableState = {
    ...createZeroWritableShellState(),
    status: 'resolving',
    mode: 'resolving',
  };
  store.openZeroWritable();
}

const spellingAutoAdvance = createSpellingAutoAdvanceController({
  getState: () => store.getState(),
  dispatchContinue: () => dispatchAction('spelling-continue'),
});

function ensureSpellingAutoAdvanceFromCurrentState() {
  const appState = store.getState();
  if (appState.route.screen !== 'subject' || appState.route.subjectId !== 'spelling' || (appState.route.tab || 'practice') !== 'practice') {
    return false;
  }
  return spellingAutoAdvance.ensureScheduledFromState(appState.subjectUi.spelling);
}

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
    ...buildHubModels(appState),
  };
}

function render() {
  const appState = store.getState();
  root.innerHTML = renderApp(appState, contextFor(appState.route.subjectId || 'spelling'));
  ensureSpellingAutoAdvanceFromCurrentState();

  if (boot.session.signedIn) {
    if (
      appState.route.screen === 'zero-writable'
      && zeroWritableState.status === 'resolving'
      && !zeroWritableState.submitting
      && adultSurfaceState.parentHub.status !== 'loading'
      && adultSurfaceState.adminHub.status !== 'loading'
    ) {
      queueMicrotask(() => {
        if (
          store.getState().route.screen === 'zero-writable'
          && zeroWritableState.status === 'resolving'
          && !zeroWritableState.submitting
          && adultSurfaceState.parentHub.status !== 'loading'
          && adultSurfaceState.adminHub.status !== 'loading'
        ) {
          routeHomeForCurrentAccount({ force: true });
        }
      });
    }
    if (appState.route.screen === 'parent-hub') {
      queueMicrotask(() => {
        loadParentHub();
      });
    }
    if (appState.route.screen === 'admin-hub') {
      queueMicrotask(() => {
        loadAdminHub();
        loadAdminAccounts();
      });
    }
  } else if (appState.route.screen === 'admin-hub') {
    queueMicrotask(() => loadAdminAccounts());
  }

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
    clearAdultSurfaceNotice();
    clearZeroWritableNotice();
    tts.stop();
    return routeHomeForCurrentAccount({ force: true });
  }

  if (action === 'open-subject') {
    if (blockReadOnlyAdultAction(action)) return true;
    tts.stop();
    if (boot.session.signedIn && !hasWritableLearnerInShell(appState)) {
      clearAdultSurfaceNotice({ rerender: false });
      return routeHomeForCurrentAccount({
        notice: zeroWritableSubjectRedirectMessage(shellPlatformRole),
        force: true,
      });
    }
    clearAdultSurfaceNotice();
    clearZeroWritableNotice();
    resetZeroWritableState({ rerender: false });
    store.openSubject(data.subjectId || 'spelling', data.tab || 'practice');
    return true;
  }

  if (action === 'open-parent-hub') {
    tts.stop();
    clearZeroWritableNotice();
    if (boot.session.signedIn && !hasWritableLearnerInShell(appState) && normalisePlatformRole(shellPlatformRole) === 'parent') {
      clearAdultSurfaceNotice({ rerender: false });
      return routeHomeForCurrentAccount({ force: true });
    }
    clearAdultSurfaceNotice();
    store.openParentHub();
    if (boot.session.signedIn) loadParentHub({ force: true });
    return true;
  }

  if (action === 'open-admin-hub') {
    tts.stop();
    clearZeroWritableNotice();
    if (boot.session.signedIn && !hasWritableLearnerInShell(appState)) {
      const resolvedRole = normalisePlatformRole(shellPlatformRole);
      if (resolvedRole === 'admin' || resolvedRole === 'ops') {
        clearAdultSurfaceNotice({ rerender: false });
        return routeHomeForCurrentAccount({ force: true });
      }
    }
    clearAdultSurfaceNotice();
    store.openAdminHub();
    if (boot.session.signedIn) loadAdminHub({ force: true });
    loadAdminAccounts();
    return true;
  }

  if (action === 'admin-accounts-refresh') {
    loadAdminAccounts({ force: true });
    return true;
  }

  if (action === 'admin-account-role-set') {
    updateAdminAccountRole(data.accountId, data.value);
    return true;
  }

  if (action === 'shell-set-role') {
    if (!boot.session.signedIn) {
      shellPlatformRole = normalisePlatformRole(data.value);
      store.patch(() => ({}));
    }
    return true;
  }

  if (action === 'subject-set-tab') {
    store.setTab(data.tab || 'practice');
    return true;
  }

  if (action === 'adult-surface-learner-select') {
    const nextLearnerId = String(data.value || '').trim();
    if (!nextLearnerId) return true;
    adultSurfaceState = {
      ...adultSurfaceState,
      selectedLearnerId: nextLearnerId,
      notice: '',
    };
    if (appState.learners.byId[nextLearnerId] && appState.learners.selectedId !== nextLearnerId) {
      tts.stop();
      runtimeBoundary.clearAll();
      store.selectLearner(nextLearnerId);
    }
    if (appState.route.screen === 'admin-hub') loadAdminHub({ learnerId: nextLearnerId, force: true });
    else loadParentHub({ learnerId: nextLearnerId, force: true });
    return true;
  }

  if (action === 'learner-select') {
    const nextLearnerId = String(data.value || '').trim();
    if (!nextLearnerId) return true;
    clearAdultSurfaceNotice();
    clearZeroWritableNotice();
    resetZeroWritableState({ rerender: false });
    adultSurfaceState = {
      ...adultSurfaceState,
      selectedLearnerId: nextLearnerId,
    };
    tts.stop();
    runtimeBoundary.clearAll();
    store.selectLearner(nextLearnerId);
    if (boot.session.signedIn) {
      if (appState.route.screen === 'parent-hub') loadParentHub({ learnerId: nextLearnerId, force: true });
      if (appState.route.screen === 'admin-hub') loadAdminHub({ learnerId: nextLearnerId, force: true });
    }
    return true;
  }

  if (action === 'create-first-learner') {
    const formData = data.formData;
    const name = String(formData?.get('name') || '').trim();
    const yearGroup = ['Y3', 'Y4', 'Y5', 'Y6'].includes(String(formData?.get('yearGroup') || ''))
      ? String(formData.get('yearGroup'))
      : 'Y5';
    const form = { name, yearGroup };

    if (!name) {
      patchZeroWritableState((current) => ({
        ...current,
        status: 'onboarding',
        mode: 'create-first-learner',
        form,
        submitting: false,
        error: 'Enter a learner name to create the first learner.',
      }), { rerender: true });
      store.openZeroWritable();
      return true;
    }

    patchZeroWritableState((current) => ({
      ...current,
      status: 'onboarding',
      mode: 'create-first-learner',
      form,
      submitting: true,
      error: '',
      notice: '',
    }), { rerender: true });

    tts.stop();

    (async () => {
      try {
        const sessionPayload = await readCurrentWorkerSession();
        const expectedAccountRevision = Math.max(0, Number(sessionPayload?.account?.repoRevision) || 0);
        const newLearnerId = uid('learner');
        const nextLearner = {
          id: newLearnerId,
          name,
          yearGroup,
          goal: 'sats',
          dailyMinutes: 15,
          avatarColor: '#3E6FA8',
          createdAt: Date.now(),
        };
        const nextLearners = {
          byId: { ...appState.learners.byId, [newLearnerId]: nextLearner },
          allIds: [...appState.learners.allIds, newLearnerId],
          selectedId: newLearnerId,
        };

        const requestId = uid('create-first-learner');
        const response = await credentialFetch('/api/learners', {
          method: 'PUT',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            learners: nextLearners,
            mutation: {
              requestId,
              correlationId: requestId,
              expectedAccountRevision,
            },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'Could not create the first learner.');

        boot.session.repoRevision = Number(payload?.syncState?.accountRevision) || boot.session.repoRevision;

        await repositories.hydrate({
          cacheScope: 'create-first-learner',
          rebasePending: true,
          rebasePayloads: true,
        });

        adultSurfaceState = {
          ...adultSurfaceState,
          selectedLearnerId: newLearnerId,
          notice: '',
          parentHub: createHubLoadState(),
          adminHub: createHubLoadState(),
        };
        runtimeBoundary.clearAll();
        resetZeroWritableState({ rerender: false });
        clearAdultSurfaceNotice({ rerender: false });
        store.reloadFromRepositories();
        store.goHome();
      } catch (error) {
        patchZeroWritableState((current) => ({
          ...current,
          status: 'onboarding',
          mode: 'create-first-learner',
          form,
          submitting: false,
          error: error?.message || 'Could not create the first learner.',
        }), { rerender: true });
        store.openZeroWritable();
      }
    })();
    return true;
  }

  if (action === 'learner-create') {
    if (blockReadOnlyAdultAction(action)) return true;
    if (boot.session.signedIn && !hasWritableLearnerInShell(appState)) {
      return routeHomeForCurrentAccount({ force: true });
    }
    const current = appState.learners.byId[learnerId];
    clearZeroWritableNotice();
    resetZeroWritableState({ rerender: false });
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
    if (blockReadOnlyAdultAction(action)) return true;
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
    if (blockReadOnlyAdultAction(action)) return true;
    if (!globalThis.confirm('Delete the current learner and all their subject progress and codex state?')) return true;
    runtimeBoundary.clearLearner(learnerId);
    resetLearnerData(learnerId);
    store.deleteLearner(learnerId);
    return true;
  }

  if (action === 'learner-reset-progress') {
    if (blockReadOnlyAdultAction(action)) return true;
    if (!globalThis.confirm('Reset subject progress and codex rewards for the current learner?')) return true;
    tts.stop();
    runtimeBoundary.clearLearner(learnerId);
    resetLearnerData(learnerId);
    store.resetSubjectUi();
    return true;
  }

  if (action === 'platform-reset-all') {
    if (blockReadOnlyAdultAction(action)) return true;
    if (!globalThis.confirm('Reset all app data for every learner on this browser?')) return true;
    tts.stop();
    runtimeBoundary.clearAll();
    store.clearAllProgress();
    globalThis.location.reload();
    return true;
  }

  if (action === 'platform-export-learner') {
    if (blockReadOnlyAdultAction(action)) return true;
    const payload = exportLearnerSnapshot(repositories, learnerId);
    downloadJson(`${sanitiseFilenamePart(learner?.name)}-ks2-platform-learner.json`, payload);
    return true;
  }

  if (action === 'platform-export-app') {
    if (blockReadOnlyAdultAction(action)) return true;
    const payload = exportPlatformSnapshot(repositories);
    downloadJson('ks2-platform-data.json', payload);
    return true;
  }

  if (action === 'platform-import') {
    if (blockReadOnlyAdultAction(action)) return true;
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
    handleSpellingContentMutation(
      () => spellingContent.publishDraft({ notes: 'Published from the in-app operator hook.' }),
      'Spelling content published as a new release.',
    );
    return true;
  }

  if (action === 'spelling-content-reset') {
    if (!globalThis.confirm('Reset spelling content to the bundled published baseline?')) return true;
    handleSpellingContentMutation(
      () => spellingContent.resetToSeeded(),
      'Spelling content reset to the bundled baseline.',
    );
    return true;
  }

  if (action === 'toast-dismiss') {
    store.dismissToast(Number(data.index));
    return true;
  }

  if (action === 'persistence-retry') {
    repositories.persistence.retry()
      .then(() => {
        tts.stop();
        runtimeBoundary.clearAll();
        const refreshedState = store.reloadFromRepositories({ preserveRoute: true });
        if (boot.session.signedIn && !hasWritableLearnerInShell(refreshedState)) {
          routeHomeForCurrentAccount({ force: true });
        } else {
          resetZeroWritableState({ rerender: false });
        }
      })
      .catch((error) => {
        globalThis.console?.warn?.('Persistence retry failed.', error);
      });
    return true;
  }

  if (action === 'platform-logout') {
    credentialFetch('/api/auth/logout', { method: 'POST' })
      .finally(() => {
        globalThis.location.href = '/';
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
  if (!handleGlobalAction(action, data)) {
    handleSubjectAction(action, data);
  }
  ensureSpellingAutoAdvanceFromCurrentState();
}

function extractActionData(target) {
  return {
    action: target.dataset.action,
    subjectId: target.dataset.subjectId,
    accountId: target.dataset.accountId,
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
  if (!shouldDispatchClickAction(target)) return;
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

function dispatchTextInputAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return false;
  const action = target.dataset.action;
  if (!action) return false;
  if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) return false;
  if (['checkbox', 'radio', 'file'].includes(String(target.type || '').toLowerCase())) return false;
  dispatchAction(action, extractActionData(target));
  return true;
}

root.addEventListener('input', (event) => {
  dispatchTextInputAction(event);
});

root.addEventListener('search', (event) => {
  dispatchTextInputAction(event);
}, true);

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
