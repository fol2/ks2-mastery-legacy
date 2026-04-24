import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRepositoryServer } from './helpers/worker-server.js';

function productionServer() {
  return createWorkerRepositoryServer({
    env: {
      AUTH_MODE: 'production',
      ENVIRONMENT: 'production',
      APP_HOSTNAME: 'repo.test',
    },
  });
}

function rejectTransactionSql(db) {
  return {
    prepare: (...args) => db.prepare(...args),
    batch: (...args) => db.batch(...args),
    exec: async sql => {
      if (/\b(SAVEPOINT|BEGIN|COMMIT|ROLLBACK|RELEASE)\b/i.test(String(sql || ''))) {
        throw new Error('transaction control SQL is not supported by this D1 binding');
      }
      return db.exec(sql);
    },
  };
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  const match = /ks2_session=([^;]+)/.exec(setCookie);
  return match ? `ks2_session=${match[1]}` : '';
}

async function postJson(server, path, body, headers = {}) {
  return server.fetchRaw(`https://repo.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('production email registration creates an authenticated D1-backed session', async () => {
  const server = productionServer();

  const register = await postJson(server, '/api/auth/register', {
    email: 'parent@example.test',
    password: 'password-1234',
  });
  const registerPayload = await register.json();
  const cookie = cookieFrom(register);

  assert.equal(register.status, 201);
  assert.equal(registerPayload.ok, true);
  assert.match(registerPayload.session.accountId, /^adult-/);
  assert.ok(cookie);

  const session = await server.fetchRaw('https://repo.test/api/session', {
    headers: { cookie },
  });
  const sessionPayload = await session.json();

  assert.equal(session.status, 200);
  assert.equal(sessionPayload.auth.mode, 'production');
  assert.equal(sessionPayload.auth.productionReady, true);
  assert.equal(sessionPayload.session.email, 'parent@example.test');

  server.close();
});

test('production auth session probe returns an unauthenticated payload without changing the protected session route', async () => {
  const server = productionServer();

  const protectedSession = await server.fetchRaw('https://repo.test/api/session');
  assert.equal(protectedSession.status, 401);

  const authSession = await server.fetchRaw('https://repo.test/api/auth/session');
  const payload = await authSession.json();

  assert.equal(authSession.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.auth.mode, 'production');
  assert.equal(payload.session, null);
  assert.equal(payload.account, null);
  assert.equal(payload.learnerCount, 0);

  server.close();
});

test('production email registration does not rely on transaction control SQL', async () => {
  const server = productionServer();
  server.env.DB = rejectTransactionSql(server.DB);

  const register = await postJson(server, '/api/auth/register', {
    email: 'cloudflare-d1@example.test',
    password: 'password-1234',
  });
  const registerPayload = await register.json();

  assert.equal(register.status, 201);
  assert.equal(registerPayload.ok, true);
  assert.ok(cookieFrom(register));

  server.close();
});

test('production login rejects bad credentials and accepts the registered password', async () => {
  const server = productionServer();

  await postJson(server, '/api/auth/register', {
    email: 'login@example.test',
    password: 'password-1234',
  });

  const badLogin = await postJson(server, '/api/auth/login', {
    email: 'login@example.test',
    password: 'wrong-password',
  });
  const badPayload = await badLogin.json();
  assert.equal(badLogin.status, 400);
  assert.equal(badPayload.code, 'invalid_credentials');

  const goodLogin = await postJson(server, '/api/auth/login', {
    email: 'login@example.test',
    password: 'password-1234',
  });
  assert.equal(goodLogin.status, 200);
  assert.ok(cookieFrom(goodLogin));

  server.close();
});

test('production logout clears the server session and cookie', async () => {
  const server = productionServer();
  const register = await postJson(server, '/api/auth/register', {
    email: 'logout@example.test',
    password: 'password-1234',
  });
  const cookie = cookieFrom(register);

  const logout = await postJson(server, '/api/auth/logout', {}, { cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);

  const session = await server.fetchRaw('https://repo.test/api/session', {
    headers: { cookie },
  });
  assert.equal(session.status, 401);

  const authSession = await server.fetchRaw('https://repo.test/api/auth/session', {
    headers: { cookie },
  });
  const authSessionPayload = await authSession.json();
  assert.equal(authSession.status, 200);
  assert.equal(authSessionPayload.session, null);

  server.close();
});

test('social sign-in start is explicit when a provider is not configured', async () => {
  const server = productionServer();

  const response = await postJson(server, '/api/auth/google/start', {});
  const payload = await response.json();

  assert.equal(response.status, 501);
  assert.equal(payload.code, 'auth_provider_not_configured');

  server.close();
});
