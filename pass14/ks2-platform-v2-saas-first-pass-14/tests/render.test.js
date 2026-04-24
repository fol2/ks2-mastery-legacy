import test from 'node:test';
import assert from 'node:assert/strict';

import { installMemoryStorage } from './helpers/memory-storage.js';
import {
  createApiPlatformRepositories,
  createLocalPlatformRepositories,
} from '../src/platform/core/repositories/index.js';
import { createStore } from '../src/platform/core/store.js';
import { SUBJECTS } from '../src/platform/core/subject-registry.js';
import { renderApp } from '../src/platform/ui/render.js';
import { createSpellingService } from '../src/subjects/spelling/service.js';
import { createSpellingPersistence } from '../src/subjects/spelling/repository.js';
import { buildParentHubReadModel } from '../src/platform/hubs/parent-read-model.js';
import { buildAdminHubReadModel } from '../src/platform/hubs/admin-read-model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../src/subjects/spelling/data/content-data.js';
import { createHubApi } from '../src/platform/hubs/api.js';
import {
  buildAdminHubAccessContext,
  buildParentHubAccessContext,
} from '../src/platform/hubs/shell-access.js';
import { createWorkerRepositoryServer } from './helpers/worker-server.js';

test('dashboard render smoke test covers spelling subject dashboard stats without crashing', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const store = createStore(SUBJECTS, { repositories });
  const service = createSpellingService({
    repository: createSpellingPersistence({ repositories }),
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
  });

  const appState = store.getState();
  const html = renderApp(appState, {
    appState,
    store,
    repositories,
    services: { spelling: service },
    subject: SUBJECTS[0],
    service,
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
    applySubjectTransition() {
      return true;
    },
  });

  assert.match(html, /Subject registry/);
  assert.match(html, /Spelling/);
  assert.match(html, /Live \/ ready/);
  assert.doesNotMatch(html, /Temporarily unavailable/);
});

test('render app exposes parent and admin operating surfaces by route', () => {
  const storage = installMemoryStorage();
  const repositories = createLocalPlatformRepositories({ storage });
  const store = createStore(SUBJECTS, { repositories });
  const appState = store.getState();
  const learner = appState.learners.byId[appState.learners.selectedId];
  const baseContext = {
    appState,
    store,
    repositories,
    services: {},
    subject: SUBJECTS[0],
    service: null,
    tts: {
      speak() {},
      stop() {},
      warmup() {},
    },
    applySubjectTransition() {
      return true;
    },
    shellAccess: { platformRole: 'parent', source: 'local-reference' },
  };

  store.openParentHub();
  const parentState = store.getState();
  const parentHtml = renderApp(parentState, {
    ...baseContext,
    appState: parentState,
    parentHub: buildParentHubReadModel({ learner, platformRole: 'parent', membershipRole: 'owner' }),
  });
  assert.match(parentHtml, /Parent Hub thin slice/);

  store.openAdminHub();
  const adminState = store.getState();
  const adminHtml = renderApp(adminState, {
    ...baseContext,
    appState: adminState,
    shellAccess: { platformRole: 'admin', source: 'local-reference' },
    adminHub: buildAdminHubReadModel({
      account: { id: 'local-browser', platformRole: 'admin' },
      platformRole: 'admin',
      spellingContentBundle: SEEDED_SPELLING_CONTENT_BUNDLE,
    }),
    adminAccountDirectory: {
      status: 'loaded',
      accounts: [
        {
          id: 'adult-admin',
          email: 'fol2hk@gmail.com',
          displayName: 'James',
          platformRole: 'admin',
          providers: ['google'],
          learnerCount: 3,
        },
        {
          id: 'adult-parent',
          email: 'parent@example.com',
          displayName: 'Parent',
          platformRole: 'parent',
          providers: ['email'],
          learnerCount: 1,
        },
      ],
      error: '',
    },
  });
  assert.match(adminHtml, /Admin \/ operations skeleton/);
  assert.match(adminHtml, /Account roles/);
  assert.match(adminHtml, /fol2hk@gmail.com/);
  assert.match(adminHtml, /data-action="admin-account-role-set"/);
});


function makeTtsStub() {
  return {
    speak() {},
    stop() {},
    warmup() {},
  };
}

function seedAdultAccount(server, {
  id,
  email,
  displayName,
  platformRole = 'parent',
  now = 1,
} = {}) {
  server.DB.db.prepare(`
    INSERT INTO adult_accounts (id, email, display_name, platform_role, selected_learner_id, created_at, updated_at, repo_revision)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 0)
  `).run(id, email, displayName, platformRole, now, now);
}

async function seedRemoteLearnerData(server, accountId, platformRole = 'parent') {
  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor(accountId, { platformRole }),
  });
  await repositories.hydrate();
  repositories.learners.write({
    byId: {
      'learner-a': {
        id: 'learner-a',
        name: 'Ava',
        yearGroup: 'Y5',
        goal: 'sats',
        dailyMinutes: 15,
        avatarColor: '#3E6FA8',
        createdAt: 1,
      },
    },
    allIds: ['learner-a'],
    selectedId: 'learner-a',
  });
  repositories.subjectStates.writeData('learner-a', 'spelling', {
    prefs: { mode: 'smart' },
    progress: {
      possess: { stage: 4, attempts: 4, correct: 4, wrong: 0, dueDay: 999999, lastDay: 10, lastResult: true },
      bicycle: { stage: 1, attempts: 3, correct: 1, wrong: 2, dueDay: 0, lastDay: 11, lastResult: false },
    },
  });
  repositories.practiceSessions.write({
    id: 'sess-parent',
    learnerId: 'learner-a',
    subjectId: 'spelling',
    sessionKind: 'learning',
    status: 'completed',
    sessionState: null,
    summary: {
      label: 'Smart review',
      cards: [{ label: 'Correct', value: '6/8' }],
      mistakes: [
        { slug: 'bicycle', word: 'bicycle', family: 'cycle', year: '5-6', yearLabel: 'Years 5-6', familyWords: [] },
      ],
    },
    createdAt: 10,
    updatedAt: 20,
  });
  repositories.eventLog.append({
    id: 'retry-parent',
    type: 'spelling.retry-cleared',
    subjectId: 'spelling',
    learnerId: 'learner-a',
    family: 'cycle',
    yearBand: '5-6',
    createdAt: 30,
  });
  await repositories.flush();
}

function baseRemoteRenderContext(appState, store, repositories, extras = {}) {
  return {
    appState,
    store,
    repositories,
    services: {},
    subject: SUBJECTS[0],
    service: null,
    tts: makeTtsStub(),
    applySubjectTransition() {
      return true;
    },
    runtimeBoundary: {
      read() {
        return null;
      },
      capture() {
        return null;
      },
    },
    ...extras,
  };
}

test('signed-in parent hub renders viewer learner access from real remote payloads and blocks write affordances', async () => {
  const server = createWorkerRepositoryServer();
  await seedRemoteLearnerData(server, 'adult-owner', 'parent');
  seedAdultAccount(server, {
    id: 'adult-viewer',
    email: 'viewer@example.com',
    displayName: 'Viewer Parent',
    platformRole: 'parent',
    now: 50,
  });
  server.DB.db.prepare(`
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('adult-viewer', 'learner-a', 'viewer', 0, 50, 50);

  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-viewer', { platformRole: 'parent' }),
  });
  await repositories.hydrate();
  assert.deepEqual(repositories.learners.read().allIds, []);

  const store = createStore(SUBJECTS, { repositories });
  store.openParentHub();
  const appState = store.getState();

  const hubApi = createHubApi({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-viewer', { platformRole: 'parent' }),
  });
  const payload = await hubApi.readParentHub('learner-a');

  const html = renderApp(appState, baseRemoteRenderContext(appState, store, repositories, {
    shellAccess: { platformRole: 'parent', source: 'worker-session' },
    parentHub: payload.parentHub,
    parentHubState: { status: 'loaded', learnerId: 'learner-a', error: '', notice: '' },
    activeAdultLearnerContext: buildParentHubAccessContext(payload, appState.learners.selectedId),
    adultSurfaceNotice: '',
  }));

  assert.match(html, /Parent Hub thin slice/);
  assert.match(html, /Adult surface learner/);
  assert.match(html, /Viewer/);
  assert.match(html, /Read-only learner/);
  assert.match(html, /No writable learner in shell/);
  assert.match(html, /read-only in this adult surface/i);
  assert.match(html, /data-action="platform-export-learner"[^>]*disabled/);
  assert.match(html, /data-action="platform-export-app"[^>]*disabled/);

  server.close();
});

test('signed-in admin operations renders viewer diagnostics from real remote payloads and keeps write surfaces blocked', async () => {
  const server = createWorkerRepositoryServer();
  await seedRemoteLearnerData(server, 'adult-owner', 'parent');
  seedAdultAccount(server, {
    id: 'adult-ops-viewer',
    email: 'ops-viewer@example.com',
    displayName: 'Ops Viewer',
    platformRole: 'ops',
    now: 60,
  });
  server.DB.db.prepare(`
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('adult-ops-viewer', 'learner-a', 'viewer', 0, 60, 60);

  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-ops-viewer', { platformRole: 'ops' }),
  });
  await repositories.hydrate();
  assert.deepEqual(repositories.learners.read().allIds, []);

  const store = createStore(SUBJECTS, { repositories });
  store.openAdminHub();
  const appState = store.getState();

  const hubApi = createHubApi({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-ops-viewer', { platformRole: 'ops' }),
  });
  const payload = await hubApi.readAdminHub({ learnerId: 'learner-a' });

  const html = renderApp(appState, baseRemoteRenderContext(appState, store, repositories, {
    shellAccess: { platformRole: 'ops', source: 'worker-session' },
    adminHub: payload.adminHub,
    adminHubState: { status: 'loaded', learnerId: 'learner-a', error: '', notice: '' },
    activeAdultLearnerContext: buildAdminHubAccessContext(payload, appState.learners.selectedId),
    adminAccountDirectory: { status: 'idle', accounts: [], error: '' },
    adultSurfaceNotice: '',
  }));

  assert.match(html, /Admin \/ operations skeleton/);
  assert.match(html, /Readable learners/);
  assert.match(html, /Viewer/);
  assert.match(html, /Read-only learner/);
  assert.match(html, /No writable learner in shell/);
  assert.match(html, /data-action="open-subject"[^>]*disabled/);
  assert.match(html, /data-action="platform-export-learner"[^>]*disabled/);
  assert.match(html, /data-action="adult-surface-learner-select"/);

  server.close();
});

test('signed-in writable member parent hub keeps owner and member flows writable when loaded from real remote payloads', async () => {
  const server = createWorkerRepositoryServer();
  await seedRemoteLearnerData(server, 'adult-owner', 'parent');
  seedAdultAccount(server, {
    id: 'adult-member',
    email: 'member@example.com',
    displayName: 'Member Parent',
    platformRole: 'parent',
    now: 70,
  });
  server.DB.db.prepare(`
    INSERT INTO account_learner_memberships (account_id, learner_id, role, sort_index, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('adult-member', 'learner-a', 'member', 0, 70, 70);

  const repositories = createApiPlatformRepositories({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-member', { platformRole: 'parent' }),
  });
  await repositories.hydrate();
  assert.deepEqual(repositories.learners.read().allIds, ['learner-a']);

  const store = createStore(SUBJECTS, { repositories });
  store.openParentHub();
  const appState = store.getState();

  const hubApi = createHubApi({
    baseUrl: 'https://repo.test',
    fetch: server.fetch.bind(server),
    authSession: server.authSessionFor('adult-member', { platformRole: 'parent' }),
  });
  const payload = await hubApi.readParentHub('learner-a');

  const html = renderApp(appState, baseRemoteRenderContext(appState, store, repositories, {
    shellAccess: { platformRole: 'parent', source: 'worker-session' },
    parentHub: payload.parentHub,
    parentHubState: { status: 'loaded', learnerId: 'learner-a', error: '', notice: '' },
    activeAdultLearnerContext: buildParentHubAccessContext(payload, appState.learners.selectedId),
    adultSurfaceNotice: '',
  }));

  assert.match(html, /Parent Hub thin slice/);
  assert.match(html, /Member/);
  assert.match(html, /Writable learner/);
  assert.doesNotMatch(html, /read-only in this adult surface/i);
  assert.doesNotMatch(html, /No writable learner in shell/);
  assert.doesNotMatch(html, /data-action="platform-export-learner"[^>]*disabled/);
  assert.doesNotMatch(html, /data-action="platform-export-app"[^>]*disabled/);

  server.close();
});
