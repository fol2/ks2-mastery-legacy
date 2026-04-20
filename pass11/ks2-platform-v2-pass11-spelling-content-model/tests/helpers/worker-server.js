import workerModule from '../../worker/src/index.js';
import { createStaticHeaderRepositoryAuthSession } from '../../src/platform/core/repositories/auth-session.js';
import { createMigratedSqliteD1Database } from './sqlite-d1.js';

function mergeHeaders(base = {}, next = {}) {
  return {
    ...base,
    ...next,
  };
}

export function createWorkerRepositoryServer({
  env: envOverrides = {},
  defaultAccountId = 'adult-a',
  defaultHeaders = {},
} = {}) {
  const DB = createMigratedSqliteD1Database();
  const env = {
    DB,
    ENVIRONMENT: 'test',
    AUTH_MODE: 'development-stub',
    ...envOverrides,
  };

  async function fetchWithHeaders(input, init = {}, headers = {}) {
    const request = new Request(typeof input === 'string' ? input : input.url, {
      ...init,
      headers: mergeHeaders(headers, init.headers || {}),
    });
    return workerModule.fetch(request, env, {});
  }

  return {
    env,
    DB,
    close() {
      DB.close();
    },
    async fetchRaw(input, init = {}) {
      return fetchWithHeaders(input, init, defaultHeaders);
    },
    async fetch(input, init = {}) {
      return fetchWithHeaders(input, init, mergeHeaders(defaultHeaders, {
        'x-ks2-dev-account-id': defaultAccountId,
      }));
    },
    async fetchAs(accountId, input, init = {}, extraHeaders = {}) {
      return fetchWithHeaders(input, init, mergeHeaders(defaultHeaders, {
        'x-ks2-dev-account-id': accountId,
        ...extraHeaders,
      }));
    },
    authSessionFor(accountId = defaultAccountId) {
      return createStaticHeaderRepositoryAuthSession({
        cacheScopeKey: `account:${accountId}`,
        headers: {
          'x-ks2-dev-account-id': accountId,
        },
      });
    },
  };
}
