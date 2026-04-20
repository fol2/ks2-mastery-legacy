import {
  applyRepositoryAuthSession,
  createNoopRepositoryAuthSession,
} from '../core/repositories/auth-session.js';

function joinUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => '');
}

async function fetchHubJson(fetchFn, url, init, authSession) {
  const requestInit = await applyRepositoryAuthSession(authSession, init);
  const response = await fetchFn(url, requestInit);
  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || `Hub request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code || null;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function createHubApi({
  baseUrl,
  fetch = globalThis.fetch?.bind(globalThis),
  authSession = createNoopRepositoryAuthSession(),
} = {}) {
  if (typeof fetch !== 'function') {
    throw new TypeError('Hub API requires a fetch implementation.');
  }

  return {
    async readParentHub(learnerId = null) {
      const url = new URL(joinUrl(baseUrl, '/api/hubs/parent'));
      if (learnerId) url.searchParams.set('learnerId', learnerId);
      return fetchHubJson(fetch, url.toString(), { method: 'GET' }, authSession);
    },
    async readAdminHub({ learnerId = null, requestId = null, auditLimit = 20 } = {}) {
      const url = new URL(joinUrl(baseUrl, '/api/hubs/admin'));
      if (learnerId) url.searchParams.set('learnerId', learnerId);
      if (requestId) url.searchParams.set('requestId', requestId);
      url.searchParams.set('auditLimit', String(auditLimit));
      return fetchHubJson(fetch, url.toString(), { method: 'GET' }, authSession);
    },
  };
}
