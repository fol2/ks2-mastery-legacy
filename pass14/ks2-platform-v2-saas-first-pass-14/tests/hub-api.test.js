import test from 'node:test';
import assert from 'node:assert/strict';

import { createHubApi } from '../src/platform/hubs/api.js';
import { createStaticHeaderRepositoryAuthSession } from '../src/platform/core/repositories/auth-session.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('hub api client calls parent hub with learner query and auth headers', async () => {
  const calls = [];
  const api = createHubApi({
    baseUrl: 'https://repo.test',
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ ok: true, learnerId: 'learner-a', parentHub: { permissions: {} } });
    },
    authSession: createStaticHeaderRepositoryAuthSession({
      cacheScopeKey: 'account:adult-parent',
      headers: { 'x-test-auth': 'adult-parent' },
    }),
  });

  const payload = await api.readParentHub('learner-a');

  assert.equal(payload.learnerId, 'learner-a');
  assert.equal(calls.length, 1);
  const requestUrl = new URL(calls[0].url);
  assert.equal(requestUrl.pathname, '/api/hubs/parent');
  assert.equal(requestUrl.searchParams.get('learnerId'), 'learner-a');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['x-test-auth'], 'adult-parent');
});

test('hub api client calls admin hub with learner, request id, audit limit, and auth headers', async () => {
  const calls = [];
  const api = createHubApi({
    baseUrl: 'https://repo.test',
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ ok: true, adminHub: { permissions: {} } });
    },
    authSession: createStaticHeaderRepositoryAuthSession({
      cacheScopeKey: 'account:adult-ops',
      headers: { 'x-test-auth': 'adult-ops' },
    }),
  });

  await api.readAdminHub({
    learnerId: 'learner-b',
    requestId: 'audit-req-1',
    auditLimit: 12,
  });

  assert.equal(calls.length, 1);
  const requestUrl = new URL(calls[0].url);
  assert.equal(requestUrl.pathname, '/api/hubs/admin');
  assert.equal(requestUrl.searchParams.get('learnerId'), 'learner-b');
  assert.equal(requestUrl.searchParams.get('requestId'), 'audit-req-1');
  assert.equal(requestUrl.searchParams.get('auditLimit'), '12');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['x-test-auth'], 'adult-ops');
});
