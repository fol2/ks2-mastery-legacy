import { cloneSerialisable } from '../../../platform/core/repositories/helpers.js';
import { uid } from '../../../platform/core/utils.js';
import { applyRepositoryAuthSession, createNoopRepositoryAuthSession } from '../../../platform/core/repositories/auth-session.js';
import {
  normaliseSpellingContentBundle,
} from './model.js';
import { SEEDED_SPELLING_CONTENT_BUNDLE } from '../data/content-data.js';

const STORAGE_KEY = 'ks2-platform-v2.spelling-content';

function createNoopStorage() {
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  const text = await response.text().catch(() => '');
  return text ? { message: text } : null;
}

export function createLocalSpellingContentRepository({ storage } = {}) {
  const resolvedStorage = storage || globalThis.localStorage || createNoopStorage();

  function read() {
    try {
      const raw = resolvedStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
      return normaliseSpellingContentBundle(JSON.parse(raw));
    } catch {
      return cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
    }
  }

  function write(rawBundle) {
    const bundle = normaliseSpellingContentBundle(rawBundle);
    resolvedStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    return cloneSerialisable(bundle);
  }

  function clear() {
    resolvedStorage.removeItem(STORAGE_KEY);
    return cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
  }

  return {
    kind: 'local-spelling-content',
    read,
    write,
    clear,
  };
}

export function createApiSpellingContentRepository({
  baseUrl = '',
  fetch: fetchImpl = globalThis.fetch,
  authSession = createNoopRepositoryAuthSession(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('API spelling content repository requires fetch().');
  }

  let cachedBundle = cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
  let accountRevision = 0;

  async function request(path, init = {}) {
    const prepared = await applyRepositoryAuthSession(authSession, init);
    const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, '')}${path}`, prepared);
    const payload = await parseJsonResponse(response);
    if (!response.ok) {
      const error = new Error(payload?.message || `Spelling content request failed (${response.status}).`);
      error.status = response.status;
      error.code = payload?.code || null;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function hydrate() {
    const payload = await request('/api/content/spelling', { method: 'GET' });
    cachedBundle = normaliseSpellingContentBundle(payload?.content || SEEDED_SPELLING_CONTENT_BUNDLE);
    accountRevision = Math.max(0, Number(payload?.mutation?.accountRevision) || 0);
    return cloneSerialisable(cachedBundle);
  }

  function read() {
    return cloneSerialisable(cachedBundle);
  }

  async function write(rawBundle) {
    const bundle = normaliseSpellingContentBundle(rawBundle);
    const requestId = uid('content');
    const payload = await request('/api/content/spelling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: bundle,
        mutation: {
          requestId,
          correlationId: requestId,
          expectedAccountRevision: accountRevision,
        },
      }),
    });
    cachedBundle = normaliseSpellingContentBundle(payload?.content || bundle);
    accountRevision = Math.max(
      accountRevision,
      Number(payload?.mutation?.accountRevision) || Number(payload?.mutation?.appliedRevision) || accountRevision,
    );
    return cloneSerialisable(cachedBundle);
  }

  async function clear() {
    cachedBundle = cloneSerialisable(SEEDED_SPELLING_CONTENT_BUNDLE);
    return write(cachedBundle);
  }

  return {
    kind: 'api-spelling-content',
    hydrate,
    read,
    write,
    clear,
    getAccountRevision() {
      return accountRevision;
    },
  };
}
