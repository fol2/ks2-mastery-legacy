function normaliseHeaders(input) {
  const headers = {};
  if (!input || typeof input !== 'object') return headers;
  for (const [key, value] of Object.entries(input)) {
    if (typeof key !== 'string' || !key) continue;
    if (value == null) continue;
    headers[key] = String(value);
  }
  return headers;
}

export function createNoopRepositoryAuthSession() {
  return {
    kind: 'none',
    getCacheScopeKey() {
      return 'default';
    },
    async getRequestHeaders() {
      return {};
    },
  };
}

export function createStaticHeaderRepositoryAuthSession({ headers = {}, cacheScopeKey = 'default' } = {}) {
  const resolvedHeaders = normaliseHeaders(headers);
  const resolvedCacheScopeKey = typeof cacheScopeKey === 'string' && cacheScopeKey
    ? cacheScopeKey
    : 'default';

  return {
    kind: 'static-headers',
    getCacheScopeKey() {
      return resolvedCacheScopeKey;
    },
    async getRequestHeaders() {
      return { ...resolvedHeaders };
    },
  };
}

export async function applyRepositoryAuthSession(authSession, init = {}) {
  const session = authSession && typeof authSession === 'object'
    ? authSession
    : createNoopRepositoryAuthSession();
  const extraHeaders = typeof session.getRequestHeaders === 'function'
    ? normaliseHeaders(await session.getRequestHeaders())
    : {};

  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...extraHeaders,
    },
  };
}

export function repositoryAuthCacheScopeKey(authSession) {
  const session = authSession && typeof authSession === 'object'
    ? authSession
    : createNoopRepositoryAuthSession();
  const scopeKey = typeof session.getCacheScopeKey === 'function'
    ? session.getCacheScopeKey()
    : 'default';
  return typeof scopeKey === 'string' && scopeKey ? scopeKey : 'default';
}
