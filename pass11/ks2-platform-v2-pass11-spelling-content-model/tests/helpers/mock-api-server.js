function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readBody(init = {}) {
  if (!init.body) return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

function subjectStateKey(learnerId, subjectId) {
  return `${learnerId || 'default'}::${subjectId || 'unknown'}`;
}

function gameStateKey(learnerId, systemId) {
  return `${learnerId || 'default'}::${systemId || 'unknown'}`;
}

function practiceSessionKey(record) {
  return `${record?.learnerId || 'default'}::${record?.subjectId || 'unknown'}::${record?.id || 'session'}`;
}

function failureKey(method, path) {
  return `${String(method || 'GET').toUpperCase()} ${path}`;
}

function normaliseFailureConfig(config = {}) {
  return {
    status: Number.isFinite(Number(config.status)) ? Number(config.status) : 503,
    body: config.body || { ok: false, message: 'Forced repository failure.' },
    count: config.count === Infinity ? Infinity : Math.max(1, Number.isFinite(Number(config.count)) ? Number(config.count) : 1),
  };
}

export function createMockRepositoryServer(initial = {}) {
  const store = {
    learners: initial.learners || { byId: {}, allIds: [], selectedId: null },
    subjectStates: initial.subjectStates || {},
    practiceSessions: initial.practiceSessions || [],
    gameState: initial.gameState || {},
    eventLog: initial.eventLog || [],
  };
  const failures = new Map();
  const requests = [];

  function maybeFail(method, path) {
    const key = failureKey(method, path);
    const active = failures.get(key);
    if (!active) return null;
    if (active.count !== Infinity) {
      active.count -= 1;
      if (active.count <= 0) failures.delete(key);
    }
    return json(active.body, active.status);
  }

  return {
    store,
    requests,
    failNext(method, path, config = {}) {
      failures.set(failureKey(method, path), normaliseFailureConfig({ ...config, count: 1 }));
    },
    setFailure(method, path, config = {}) {
      failures.set(failureKey(method, path), normaliseFailureConfig({ ...config, count: config.count ?? Infinity }));
    },
    clearFailure(method, path) {
      failures.delete(failureKey(method, path));
    },
    clearFailures() {
      failures.clear();
    },
    async fetch(input, init = {}) {
      const url = new URL(typeof input === 'string' ? input : input.url, 'https://repo.test');
      const method = (init.method || 'GET').toUpperCase();
      const body = await readBody(init);
      requests.push({ method, path: url.pathname, body });

      const forced = maybeFail(method, url.pathname);
      if (forced) return forced;

      if (url.pathname === '/api/bootstrap' && method === 'GET') {
        return json({
          ok: true,
          learners: store.learners,
          subjectStates: store.subjectStates,
          practiceSessions: store.practiceSessions,
          gameState: store.gameState,
          eventLog: store.eventLog,
        });
      }

      if (url.pathname === '/api/learners' && method === 'PUT') {
        store.learners = body.learners || store.learners;
        return json({ ok: true, learners: store.learners });
      }

      if (url.pathname === '/api/child-subject-state' && method === 'PUT') {
        store.subjectStates[subjectStateKey(body.learnerId, body.subjectId)] = body.record || { ui: null, data: {}, updatedAt: Date.now() };
        return json({ ok: true });
      }

      if (url.pathname === '/api/child-subject-state' && method === 'DELETE') {
        if (body.subjectId) {
          delete store.subjectStates[subjectStateKey(body.learnerId, body.subjectId)];
        } else {
          for (const key of Object.keys(store.subjectStates)) {
            if (key.startsWith(`${body.learnerId || 'default'}::`)) delete store.subjectStates[key];
          }
        }
        return json({ ok: true });
      }

      if (url.pathname === '/api/practice-sessions' && method === 'PUT') {
        const key = practiceSessionKey(body.record || {});
        const index = store.practiceSessions.findIndex((record) => practiceSessionKey(record) === key);
        if (index >= 0) store.practiceSessions[index] = body.record;
        else store.practiceSessions.push(body.record);
        return json({ ok: true });
      }

      if (url.pathname === '/api/practice-sessions' && method === 'DELETE') {
        store.practiceSessions = store.practiceSessions.filter((record) => (
          record.learnerId !== body.learnerId || (body.subjectId && record.subjectId !== body.subjectId)
        ));
        return json({ ok: true });
      }

      if (url.pathname === '/api/child-game-state' && method === 'PUT') {
        store.gameState[gameStateKey(body.learnerId, body.systemId)] = body.state || {};
        return json({ ok: true });
      }

      if (url.pathname === '/api/child-game-state' && method === 'DELETE') {
        if (body.systemId) {
          delete store.gameState[gameStateKey(body.learnerId, body.systemId)];
        } else {
          for (const key of Object.keys(store.gameState)) {
            if (key.startsWith(`${body.learnerId || 'default'}::`)) delete store.gameState[key];
          }
        }
        return json({ ok: true });
      }

      if (url.pathname === '/api/event-log' && method === 'POST') {
        if (body.event) store.eventLog.push(body.event);
        return json({ ok: true, count: store.eventLog.length });
      }

      if (url.pathname === '/api/event-log' && method === 'DELETE') {
        store.eventLog = store.eventLog.filter((event) => event?.learnerId !== body.learnerId);
        return json({ ok: true });
      }

      if (url.pathname === '/api/debug/reset' && method === 'POST') {
        store.learners = { byId: {}, allIds: [], selectedId: null };
        store.subjectStates = {};
        store.practiceSessions = [];
        store.gameState = {};
        store.eventLog = [];
        return json({ ok: true });
      }

      return json({ ok: false, message: 'Not found' }, 404);
    },
  };
}
