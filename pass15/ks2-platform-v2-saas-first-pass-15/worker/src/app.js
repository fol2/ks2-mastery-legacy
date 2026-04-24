import {
  clearSessionCookie,
  completeSocialLogin,
  createSessionAuthBoundary,
  deleteCurrentSession,
  loginWithEmail,
  registerWithEmail,
  startSocialLogin,
} from './auth.js';
import { requireDatabase } from './d1.js';
import { errorResponse } from './errors.js';
import { json, readForm, readJson } from './http.js';
import { createWorkerRepository } from './repository.js';
import { handleTextToSpeechRequest } from './tts.js';

function withCookies(response, cookies = []) {
  cookies.filter(Boolean).forEach((cookie) => response.headers.append('set-cookie', cookie));
  return response;
}

function redirect(location, status = 302, cookies = []) {
  const response = new Response(null, {
    status,
    headers: {
      location,
      'cache-control': 'no-store',
    },
  });
  return withCookies(response, cookies);
}

function callbackErrorRedirect(request, message) {
  const url = new URL(request.url);
  return redirect(`${url.origin}/?auth_error=${encodeURIComponent(message || 'Could not complete sign-in.')}`);
}

function mutationFromRequest(body, request) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const raw = payload.mutation && typeof payload.mutation === 'object' && !Array.isArray(payload.mutation)
    ? payload.mutation
    : {};
  const requestId = raw.requestId || request.headers.get('x-ks2-request-id') || null;
  const correlationId = raw.correlationId || request.headers.get('x-ks2-correlation-id') || requestId || null;
  return {
    ...raw,
    requestId,
    correlationId,
  };
}

async function sessionPayload({ session, auth, env, now }) {
  if (!session) {
    return {
      ok: true,
      auth: auth.describe(),
      session: null,
      account: null,
      learnerCount: 0,
    };
  }

  const repository = createWorkerRepository({ env, now });
  const account = await repository.ensureAccount(session);
  const learnerIds = await repository.accessibleLearnerIds(session.accountId);
  return {
    ok: true,
    auth: auth.describe(),
    session,
    account: account
      ? {
        id: account.id,
        email: account.email,
        displayName: account.display_name,
        selectedLearnerId: account.selected_learner_id || null,
        repoRevision: Number(account.repo_revision) || 0,
        platformRole: account.platform_role || session.platformRole || 'parent',
      }
      : null,
    learnerCount: learnerIds.length,
  };
}

export function createWorkerApp({ now = Date.now, fetchFn = (...args) => fetch(...args) } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const auth = createSessionAuthBoundary({ env });

      try {
        if (url.pathname === '/api/health') {
          let databaseStatus = 'missing';
          try {
            requireDatabase(env);
            databaseStatus = 'd1';
          } catch {
            databaseStatus = 'missing';
          }
          return json({
            ok: true,
            name: 'ks2-platform-v2-worker',
            mode: databaseStatus === 'd1' ? 'repository-d1-mvp' : 'repository-missing-db',
            auth: auth.describe(),
            mutationPolicy: {
              version: 1,
              idempotency: 'request-receipts',
              learnerScope: 'compare-and-swap',
              accountScope: 'compare-and-swap',
            },
            now: new Date(now()).toISOString(),
          });
        }

        if (url.pathname === '/api/session' && request.method === 'GET') {
          return json(await sessionPayload({
            session: await auth.requireSession(request),
            auth,
            env,
            now,
          }));
        }

        if (url.pathname === '/api/auth/session' && request.method === 'GET') {
          return json(await sessionPayload({
            session: await auth.getSession(request),
            auth,
            env,
            now,
          }));
        }

        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
          const body = await readJson(request);
          const result = await registerWithEmail(env, request, body);
          return withCookies(json(result.payload, result.status), result.cookies);
        }

        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          const body = await readJson(request);
          const result = await loginWithEmail(env, request, body);
          return withCookies(json(result.payload, result.status), result.cookies);
        }

        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
          try {
            await deleteCurrentSession(env, request);
          } finally {
            return withCookies(json({ ok: true }), [clearSessionCookie(request)]);
          }
        }

        const oauthStart = /^\/api\/auth\/([^/]+)\/start$/.exec(url.pathname);
        if (oauthStart && request.method === 'POST') {
          const body = await readJson(request);
          const result = await startSocialLogin(env, request, oauthStart[1], body);
          return withCookies(json(result.payload, result.status), result.cookies);
        }

        const oauthCallback = /^\/api\/auth\/([^/]+)\/callback$/.exec(url.pathname);
        if (oauthCallback && (request.method === 'GET' || request.method === 'POST')) {
          const payload = request.method === 'POST'
            ? await readForm(request)
            : Object.fromEntries(url.searchParams.entries());
          try {
            const result = await completeSocialLogin(env, request, oauthCallback[1], payload);
            return redirect(`${url.origin}/?auth=success`, 302, result.cookies);
          } catch (error) {
            return callbackErrorRedirect(request, error?.message);
          }
        }

        const repository = createWorkerRepository({ env, now });
        const session = await auth.requireSession(request);
        const account = await repository.ensureAccount(session);

        if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
          const bundle = await repository.bootstrap(session.accountId);
          return json({
            ok: true,
            version: '0.9.0',
            mode: 'repository-d1-mvp',
            auth: auth.describe(),
            session: {
              accountId: session.accountId,
              provider: session.provider,
              platformRole: account?.platform_role || session.platformRole || 'parent',
            },
            mutationPolicy: {
              version: 1,
              strategy: 'account-and-learner-revision-cas',
              idempotency: 'request-receipts',
              merge: 'none',
            },
            ...bundle,
          });
        }

        if (url.pathname === '/api/tts' && request.method === 'POST') {
          return await handleTextToSpeechRequest({
            env,
            request,
            session,
            now: now(),
            fetchFn,
          });
        }

        if (url.pathname === '/api/content/spelling' && request.method === 'GET') {
          const result = await repository.readSubjectContent(session.accountId, 'spelling');
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/hubs/parent' && request.method === 'GET') {
          const learnerId = url.searchParams.get('learnerId') || null;
          const result = await repository.readParentHub(session.accountId, learnerId);
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/hubs/admin' && request.method === 'GET') {
          const result = await repository.readAdminHub(session.accountId, {
            learnerId: url.searchParams.get('learnerId') || null,
            requestId: url.searchParams.get('requestId') || null,
            auditLimit: url.searchParams.get('auditLimit') || 20,
          });
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/admin/accounts' && request.method === 'GET') {
          const result = await repository.listAdminAccounts(session.accountId);
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/admin/accounts/role' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.updateAdminAccountRole(session.accountId, {
            targetAccountId: body.accountId,
            platformRole: body.platformRole,
            requestId: body.requestId || request.headers.get('x-ks2-request-id') || null,
            correlationId: body.correlationId || request.headers.get('x-ks2-correlation-id') || null,
          });
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/content/spelling' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.writeSubjectContent(
            session.accountId,
            'spelling',
            body.content,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/learners' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.writeLearners(session.accountId, body.learners, mutationFromRequest(body, request));
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/child-subject-state' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.writeSubjectState(
            session.accountId,
            body.learnerId,
            body.subjectId,
            body.record,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/child-subject-state' && request.method === 'DELETE') {
          const body = await readJson(request);
          const result = await repository.clearSubjectState(
            session.accountId,
            body.learnerId,
            body.subjectId || null,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/practice-sessions' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.writePracticeSession(session.accountId, body.record || {}, mutationFromRequest(body, request));
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/practice-sessions' && request.method === 'DELETE') {
          const body = await readJson(request);
          const result = await repository.clearPracticeSessions(
            session.accountId,
            body.learnerId,
            body.subjectId || null,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/child-game-state' && request.method === 'PUT') {
          const body = await readJson(request);
          const result = await repository.writeGameState(
            session.accountId,
            body.learnerId,
            body.systemId,
            body.state,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/child-game-state' && request.method === 'DELETE') {
          const body = await readJson(request);
          const result = await repository.clearGameState(
            session.accountId,
            body.learnerId,
            body.systemId || null,
            mutationFromRequest(body, request),
          );
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/event-log' && request.method === 'POST') {
          const body = await readJson(request);
          const result = await repository.appendEvent(session.accountId, body.event, mutationFromRequest(body, request));
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/event-log' && request.method === 'DELETE') {
          const body = await readJson(request);
          const result = await repository.clearEventLog(session.accountId, body.learnerId, mutationFromRequest(body, request));
          return json({ ok: true, ...result });
        }

        if (url.pathname === '/api/debug/reset' && request.method === 'POST') {
          const body = await readJson(request);
          const result = await repository.resetAccountScope(session.accountId, mutationFromRequest(body, request));
          return json({ ok: true, ...result });
        }

        if (env.ASSETS && request.method === 'GET') {
          return env.ASSETS.fetch(request);
        }

        return json({ ok: false, message: 'Not found.' }, 404);
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
