import {
  AuthConfigurationError,
  BadRequestError,
  ConflictError,
  UnauthenticatedError,
} from './errors.js';
import { normalisePlatformRole } from '../../src/platform/access/roles.js';
import {
  first,
  requireDatabase,
  run,
  scalar,
  withTransaction,
} from './d1.js';

const SESSION_COOKIE_NAME = 'ks2_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_TTL_SECONDS = 10 * 60;
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_LIMITS = {
  register: { ip: 6, email: 4 },
  login: { ip: 10, email: 8 },
  oauthStart: { ip: 12 },
};
const OAUTH_PROVIDERS = Object.freeze(['google', 'facebook', 'x', 'apple']);
const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function safeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalised = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64UrlToJson(value) {
  const bytes = base64UrlToBytes(value);
  return safeJsonParse(new TextDecoder().decode(bytes), {});
}

export function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashPassword(password, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64UrlToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return {
    salt,
    hash: bytesToBase64Url(new Uint8Array(bits)),
  };
}

async function verifyPassword(password, salt, expectedHash) {
  const derived = await hashPassword(password, salt);
  return derived.hash === expectedHash;
}

function normaliseEnvironmentMode(env = {}) {
  const explicit = cleanText(env.AUTH_MODE);
  if (explicit) return explicit;
  const stage = String(env.ENVIRONMENT || env.NODE_ENV || '').trim().toLowerCase();
  if (stage === 'development' || stage === 'dev' || stage === 'test') return 'development-stub';
  return 'production';
}

function normaliseProvider(provider) {
  const key = String(provider || '').trim().toLowerCase();
  if (!OAUTH_PROVIDERS.includes(key)) {
    throw new BadRequestError('Unknown sign-in provider.', { code: 'unknown_auth_provider' });
  }
  return key;
}

function requestUrl(request) {
  return new URL(request.url);
}

function secureCookieForRequest(request) {
  const url = requestUrl(request);
  if (url.protocol === 'https:') return true;
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
  return String(request.headers.get('x-forwarded-proto') || '').toLowerCase() === 'https';
}

function serialiseCookie(name, value, {
  maxAge = SESSION_TTL_MS / 1000,
  httpOnly = true,
  secure = true,
  sameSite = 'Lax',
  path = '/',
} = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value || '')}`,
    `Path=${path}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(request) {
  const header = request.headers.get('cookie') || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return;
    cookies[key] = decodeURIComponent(value || '');
  });
  return cookies;
}

function readSessionToken(request) {
  const cookies = parseCookies(request);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';
  if (cookieToken) return cookieToken;
  const auth = request.headers.get('authorization') || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

export function sessionCookie(request, token) {
  return serialiseCookie(SESSION_COOKIE_NAME, token, {
    secure: secureCookieForRequest(request),
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(request) {
  return serialiseCookie(SESSION_COOKIE_NAME, '', {
    secure: secureCookieForRequest(request),
    maxAge: 0,
  });
}

function oauthCookieName(part) {
  return `ks2_oauth_${part}`;
}

function oauthCookie(request, part, value, maxAge = OAUTH_TTL_SECONDS) {
  return serialiseCookie(oauthCookieName(part), value, {
    secure: secureCookieForRequest(request),
    maxAge,
  });
}

function oauthAttemptCookies(request, provider, attempt) {
  return [
    oauthCookie(request, 'provider', provider),
    oauthCookie(request, 'state', attempt.state),
    oauthCookie(request, 'verifier', attempt.codeVerifier || ''),
    oauthCookie(request, 'nonce', attempt.nonce || ''),
  ];
}

function clearOauthCookies(request) {
  return ['provider', 'state', 'verifier', 'nonce'].map((part) => oauthCookie(request, part, '', 0));
}

function readOauthAttempt(request) {
  const cookies = parseCookies(request);
  return {
    provider: cleanText(cookies[oauthCookieName('provider')]),
    state: cleanText(cookies[oauthCookieName('state')]),
    codeVerifier: cleanText(cookies[oauthCookieName('verifier')]),
    nonce: cleanText(cookies[oauthCookieName('nonce')]),
  };
}

function clientIp(request) {
  return cleanText(
    request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip'),
  ) || '';
}

function currentWindowStart(timestamp, windowMs) {
  return Math.floor(timestamp / windowMs) * windowMs;
}

async function consumeRateLimit(env, { bucket, identifier, limit, windowMs, now = Date.now() }) {
  if (!bucket || !identifier || !limit || !windowMs) return { allowed: true, retryAfterSeconds: 0 };
  const db = requireDatabase(env);
  const windowStartedAt = currentWindowStart(now, windowMs);
  const limiterKey = `${bucket}:${await sha256(identifier)}`;
  const row = await first(db, `
    INSERT INTO request_limits (limiter_key, window_started_at, request_count, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(limiter_key) DO UPDATE SET
      request_count = CASE
        WHEN request_limits.window_started_at = excluded.window_started_at
          THEN request_limits.request_count + 1
        ELSE 1
      END,
      window_started_at = excluded.window_started_at,
      updated_at = excluded.updated_at
    RETURNING request_count, window_started_at
  `, [limiterKey, windowStartedAt, now]);
  const count = Number(row?.request_count || 1);
  const storedWindow = Number(row?.window_started_at || windowStartedAt);
  return {
    allowed: count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil(((storedWindow + windowMs) - now) / 1000)),
  };
}

function turnstileEnabled(env = {}) {
  return Boolean(cleanText(env.TURNSTILE_SITE_KEY || env.TURNSTILE_SITEKEY) && cleanText(env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET));
}

async function verifyTurnstile(env, token, remoteIp) {
  if (!turnstileEnabled(env)) return;
  if (!cleanText(token)) {
    throw new BadRequestError('Complete the security check and try again.', { code: 'turnstile_required' });
  }
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      secret: cleanText(env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET),
      response: token,
      remoteip: remoteIp || undefined,
      idempotency_key: await sha256(token),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new BadRequestError('The security check could not be verified. Please try again.', {
      code: 'turnstile_failed',
    });
  }
}

async function protectEmailAuth(env, request, { action, email, turnstileToken }) {
  await verifyTurnstile(env, turnstileToken, clientIp(request));
  const limits = AUTH_LIMITS[action];
  const ipResult = await consumeRateLimit(env, {
    bucket: `auth-${action}-ip`,
    identifier: clientIp(request),
    limit: limits.ip,
    windowMs: AUTH_WINDOW_MS,
  });
  const emailResult = await consumeRateLimit(env, {
    bucket: `auth-${action}-email`,
    identifier: email,
    limit: limits.email,
    windowMs: AUTH_WINDOW_MS,
  });
  if (!ipResult.allowed || !emailResult.allowed) {
    throw new BadRequestError('Too many sign-in attempts. Please wait a few minutes and try again.', {
      code: 'rate_limited',
      retryAfterSeconds: Math.max(ipResult.retryAfterSeconds, emailResult.retryAfterSeconds),
    });
  }
}

async function protectOAuthStart(env, request, { provider, turnstileToken }) {
  await verifyTurnstile(env, turnstileToken, clientIp(request));
  const result = await consumeRateLimit(env, {
    bucket: `oauth-start-${provider}`,
    identifier: clientIp(request),
    limit: AUTH_LIMITS.oauthStart.ip,
    windowMs: AUTH_WINDOW_MS,
  });
  if (!result.allowed) {
    throw new BadRequestError('Too many social sign-in attempts. Please wait a few minutes and try again.', {
      code: 'rate_limited',
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

async function ensureAccountRow(db, {
  accountId,
  email = null,
  displayName = null,
  now,
}) {
  await run(db, `
    INSERT INTO adult_accounts (id, email, display_name, selected_learner_id, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = COALESCE(excluded.email, adult_accounts.email),
      display_name = COALESCE(excluded.display_name, adult_accounts.display_name),
      updated_at = excluded.updated_at
  `, [accountId, email, displayName, now, now]);
  return first(db, 'SELECT * FROM adult_accounts WHERE id = ?', [accountId]);
}

async function createSession(env, accountId, provider, now = Date.now()) {
  const db = requireDatabase(env);
  const token = randomToken(32);
  const hash = await sha256(token);
  const sessionId = `session-${randomToken(12)}`;
  await run(db, `
    INSERT INTO account_sessions (id, account_id, session_hash, provider, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [sessionId, accountId, hash, provider, now, now + SESSION_TTL_MS]);
  return { token, hash, sessionId };
}

async function accountSessionFromToken(env, token, now = Date.now()) {
  if (!token) return null;
  const db = requireDatabase(env);
  const hash = await sha256(token);
  const row = await first(db, `
    SELECT
      s.id AS session_id,
      s.session_hash,
      s.provider,
      s.expires_at,
      a.id AS account_id,
      a.email,
      a.display_name,
      a.platform_role
    FROM account_sessions s
    JOIN adult_accounts a ON a.id = s.account_id
    WHERE s.session_hash = ?
      AND s.expires_at > ?
  `, [hash, now]);
  if (!row) return null;
  return {
    accountId: row.account_id,
    email: row.email || null,
    displayName: row.display_name || null,
    platformRole: normalisePlatformRole(row.platform_role),
    provider: row.provider || 'session',
    sessionId: row.session_id,
    sessionHash: row.session_hash,
  };
}

export async function deleteCurrentSession(env, request) {
  const token = readSessionToken(request);
  if (!token) return;
  const db = requireDatabase(env);
  await run(db, 'DELETE FROM account_sessions WHERE session_hash = ?', [await sha256(token)]);
}

export async function registerWithEmail(env, request, payload = {}) {
  const email = safeEmail(payload.email);
  const password = String(payload.password || '');
  if (!email || !email.includes('@')) {
    throw new BadRequestError('Enter a valid email address.', { code: 'invalid_email' });
  }
  if (password.length < 8) {
    throw new BadRequestError('Password must be at least eight characters.', { code: 'weak_password' });
  }
  await protectEmailAuth(env, request, {
    action: 'register',
    email,
    turnstileToken: payload.turnstileToken,
  });

  const db = requireDatabase(env);
  const now = Date.now();
  const accountId = `adult-${randomToken(12)}`;
  const credential = await hashPassword(password);

  try {
    await withTransaction(db, async () => {
      await ensureAccountRow(db, {
        accountId,
        email,
        displayName: cleanText(payload.displayName) || email,
        now,
      });
      await run(db, `
        INSERT INTO account_credentials (account_id, email, password_hash, password_salt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [accountId, email, credential.hash, credential.salt, now, now]);
    });
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      throw new ConflictError('That email address is already registered.', { code: 'email_already_registered' });
    }
    throw error;
  }

  const session = await createSession(env, accountId, 'email', now);
  return {
    status: 201,
    cookies: [sessionCookie(request, session.token)],
    payload: {
      ok: true,
      session: { accountId, provider: 'email' },
    },
  };
}

export async function loginWithEmail(env, request, payload = {}) {
  const email = safeEmail(payload.email);
  const password = String(payload.password || '');
  if (!email || !password) {
    throw new BadRequestError('Incorrect email or password.', { code: 'invalid_credentials' });
  }
  await protectEmailAuth(env, request, {
    action: 'login',
    email,
    turnstileToken: payload.turnstileToken,
  });

  const db = requireDatabase(env);
  const credential = await first(db, 'SELECT * FROM account_credentials WHERE email = ?', [email]);
  if (!credential || !(await verifyPassword(password, credential.password_salt, credential.password_hash))) {
    throw new BadRequestError('Incorrect email or password.', { code: 'invalid_credentials' });
  }

  const session = await createSession(env, credential.account_id, 'email');
  return {
    status: 200,
    cookies: [sessionCookie(request, session.token)],
    payload: {
      ok: true,
      session: { accountId: credential.account_id, provider: 'email' },
    },
  };
}

function socialAuthEnabled(env) {
  return String(env.SOCIAL_LOGIN_WIRE_ENABLED || 'true').toLowerCase() !== 'false';
}

function pemToArrayBuffer(value) {
  const cleaned = String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return base64UrlToBytes(cleaned.replace(/\+/g, '-').replace(/\//g, '_'));
}

async function buildAppleClientSecret(env) {
  const header = {
    alg: 'ES256',
    kid: String(env.APPLE_KEY_ID || ''),
    typ: 'JWT',
  };
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    iss: String(env.APPLE_TEAM_ID || ''),
    iat: issuedAt,
    exp: issuedAt + (60 * 5),
    aud: 'https://appleid.apple.com',
    sub: String(env.APPLE_CLIENT_ID || ''),
  };
  const signingInput = `${bytesToBase64Url(encoder.encode(JSON.stringify(header)))}.${bytesToBase64Url(encoder.encode(JSON.stringify(payload)))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(env.APPLE_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function providerDefinitions(env, origin) {
  const enabled = socialAuthEnabled(env);
  return {
    google: {
      enabled: enabled && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      clientId: String(env.GOOGLE_CLIENT_ID || ''),
      clientSecret: String(env.GOOGLE_CLIENT_SECRET || ''),
      authoriseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      redirectUri: `${origin}/api/auth/google/callback`,
      scope: 'openid email profile',
      usePkce: true,
      extraAuthParams: { access_type: 'online', prompt: 'select_account' },
      async fetchProfile(tokenPayload) {
        const profile = await fetchBearerJson(
          'https://openidconnect.googleapis.com/v1/userinfo',
          tokenPayload.access_token,
          'Google did not return a profile.',
        );
        return {
          subject: cleanText(profile.sub),
          email: safeEmail(profile.email),
          emailVerified: Boolean(profile.email_verified),
        };
      },
    },
    facebook: {
      enabled: enabled && Boolean(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET),
      clientId: String(env.FACEBOOK_CLIENT_ID || ''),
      clientSecret: String(env.FACEBOOK_CLIENT_SECRET || ''),
      authoriseUrl: 'https://www.facebook.com/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/oauth/access_token',
      redirectUri: `${origin}/api/auth/facebook/callback`,
      scope: 'public_profile,email',
      async fetchProfile(tokenPayload) {
        const profile = await fetchBearerJson(
          'https://graph.facebook.com/me?fields=id,name,email',
          tokenPayload.access_token,
          'Facebook did not return a profile.',
        );
        return {
          subject: cleanText(profile.id),
          email: safeEmail(profile.email),
          emailVerified: Boolean(profile.email),
        };
      },
    },
    x: {
      enabled: enabled && Boolean(env.X_CLIENT_ID),
      clientId: String(env.X_CLIENT_ID || ''),
      clientSecret: String(env.X_CLIENT_SECRET || ''),
      authoriseUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.x.com/2/oauth2/token',
      redirectUri: `${origin}/api/auth/x/callback`,
      scope: 'tweet.read users.read',
      usePkce: true,
      async fetchProfile(tokenPayload) {
        const profile = await fetchBearerJson(
          'https://api.x.com/2/users/me?user.fields=name,username',
          tokenPayload.access_token,
          'X did not return a profile.',
        );
        return {
          subject: cleanText(profile?.data?.id),
          email: '',
          emailVerified: false,
        };
      },
    },
    apple: {
      enabled: enabled && Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
      clientId: String(env.APPLE_CLIENT_ID || ''),
      authoriseUrl: 'https://appleid.apple.com/auth/authorize',
      tokenUrl: 'https://appleid.apple.com/auth/token',
      redirectUri: `${origin}/api/auth/apple/callback`,
      scope: 'name email',
      useNonce: true,
      extraAuthParams: { response_mode: 'form_post' },
      async buildClientSecret() {
        return buildAppleClientSecret(env);
      },
      async fetchProfile(tokenPayload, callbackPayload, expectedNonce) {
        const claims = base64UrlToJson(String(tokenPayload.id_token || '').split('.')[1] || '');
        if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) {
          throw new Error('Apple sign-in did not return the expected nonce.');
        }
        const callbackUser = safeJsonParse(callbackPayload?.user, {});
        return {
          subject: cleanText(claims.sub),
          email: safeEmail(claims.email || callbackUser?.email),
          emailVerified: String(claims.email_verified || '').toLowerCase() === 'true' || claims.email_verified === true,
        };
      },
    },
  };
}

function configuredProvider(env, providerKey, origin) {
  const provider = providerDefinitions(env, origin)[providerKey];
  if (!provider) throw new BadRequestError('That sign-in provider is not supported.', { code: 'unknown_auth_provider' });
  if (!socialAuthEnabled(env)) throw new BadRequestError('Social sign-in is currently disabled.', { code: 'social_auth_disabled' });
  if (!provider.enabled) throw new AuthConfigurationError('That sign-in provider is not configured yet.', { code: 'auth_provider_not_configured' });
  return provider;
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  const payload = safeJsonParse(text, null);
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.message || text || fallbackMessage);
  }
  return payload || {};
}

async function fetchBearerJson(url, accessToken, fallbackMessage) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  });
  return readJsonResponse(response, fallbackMessage);
}

async function exchangeCode(provider, env, code, redirectUri, codeVerifier) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code || ''),
    client_id: provider.clientId,
    redirect_uri: redirectUri,
  });
  if (provider.clientSecret) params.set('client_secret', provider.clientSecret);
  if (provider.buildClientSecret) params.set('client_secret', await provider.buildClientSecret(env));
  if (provider.usePkce) params.set('code_verifier', String(codeVerifier || ''));

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: params.toString(),
  });
  return readJsonResponse(response, 'The provider did not return an access token.');
}

export async function startSocialLogin(env, request, providerKey, payload = {}) {
  const providerName = normaliseProvider(providerKey);
  await protectOAuthStart(env, request, {
    provider: providerName,
    turnstileToken: payload.turnstileToken,
  });
  const origin = appOrigin(env, request);
  const provider = configuredProvider(env, providerName, origin);
  const state = randomToken(18);
  const codeVerifier = provider.usePkce ? randomToken(32) : '';
  const nonce = provider.useNonce ? randomToken(18) : '';
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.scope,
    state,
    ...(provider.extraAuthParams || {}),
  });
  if (provider.usePkce) {
    params.set('code_challenge_method', 'S256');
    params.set('code_challenge', await sha256(codeVerifier));
  }
  if (nonce) params.set('nonce', nonce);
  return {
    status: 200,
    cookies: oauthAttemptCookies(request, providerName, { state, codeVerifier, nonce }),
    payload: {
      ok: true,
      redirectUrl: `${provider.authoriseUrl}?${params.toString()}`,
    },
  };
}

async function findOrCreateAccountFromIdentity(env, {
  provider,
  providerSubject,
  email,
}) {
  const db = requireDatabase(env);
  const now = Date.now();
  const existing = await first(db, `
    SELECT account_id FROM account_identities WHERE provider = ? AND provider_subject = ?
  `, [provider, providerSubject]);
  if (existing?.account_id) return existing.account_id;

  const emailAccountId = email
    ? await scalar(db, 'SELECT id FROM adult_accounts WHERE lower(email) = lower(?) LIMIT 1', [email], 'id')
    : null;
  const accountId = emailAccountId || `adult-${randomToken(12)}`;
  await withTransaction(db, async () => {
    await ensureAccountRow(db, {
      accountId,
      email: email || null,
      displayName: email || provider,
      now,
    });
    await run(db, `
      INSERT INTO account_identities (id, account_id, provider, provider_subject, email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [`identity-${randomToken(12)}`, accountId, provider, providerSubject, email || null, now, now]);
  });
  return accountId;
}

export async function completeSocialLogin(env, request, providerKey, callbackPayload = {}) {
  const providerName = normaliseProvider(providerKey);
  const attempt = readOauthAttempt(request);
  if (!attempt.state || attempt.provider !== providerName) {
    throw new BadRequestError('Sign-in session expired. Please try again.', { code: 'oauth_attempt_missing' });
  }
  if (!callbackPayload.state || callbackPayload.state !== attempt.state) {
    throw new BadRequestError('Sign-in could not be verified. Please try again.', { code: 'oauth_state_mismatch' });
  }
  if (callbackPayload.error) {
    throw new BadRequestError(callbackPayload.error_description || callbackPayload.error, { code: 'oauth_provider_error' });
  }
  if (!callbackPayload.code) {
    throw new BadRequestError('The provider did not return an authorisation code.', { code: 'oauth_code_missing' });
  }

  const origin = appOrigin(env, request);
  const provider = configuredProvider(env, providerName, origin);
  const tokenPayload = await exchangeCode(provider, env, callbackPayload.code, provider.redirectUri, attempt.codeVerifier);
  const profile = await provider.fetchProfile(tokenPayload, callbackPayload, attempt.nonce);
  if (!profile?.subject) {
    throw new BadRequestError('The provider did not return a valid account identifier.', { code: 'oauth_subject_missing' });
  }
  const accountId = await findOrCreateAccountFromIdentity(env, {
    provider: providerName,
    providerSubject: profile.subject,
    email: profile.emailVerified === false ? '' : profile.email,
  });
  const session = await createSession(env, accountId, providerName);
  return {
    cookies: [...clearOauthCookies(request), sessionCookie(request, session.token)],
  };
}

function appOrigin(env, request) {
  const configured = cleanText(env.APP_ORIGIN);
  if (configured) return configured.replace(/\/$/, '');
  const url = requestUrl(request);
  const hostname = cleanText(env.APP_HOSTNAME);
  if (hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return `https://${hostname}`;
  }
  return `${url.protocol}//${url.host}`;
}

export function createDevelopmentSessionProvider() {
  return {
    kind: 'development-stub',
    async getSession(request) {
      const accountId = cleanText(
        request.headers.get('x-ks2-dev-account-id')
        || request.headers.get('x-ks2-account-id'),
      );
      if (!accountId) return null;
      return {
        accountId,
        email: cleanText(request.headers.get('x-ks2-dev-email')),
        displayName: cleanText(request.headers.get('x-ks2-dev-name')),
        platformRole: normalisePlatformRole(request.headers.get('x-ks2-dev-platform-role')),
        provider: 'development-stub',
        sessionId: `dev:${accountId}`,
      };
    },
  };
}

export function createProductionSessionProvider() {
  return {
    kind: 'production',
    async getSession(request, env) {
      return accountSessionFromToken(env, readSessionToken(request));
    },
  };
}

export function createPlaceholderSessionProvider(kind = 'production-placeholder') {
  return {
    kind,
    async getSession() {
      throw new AuthConfigurationError(`Auth mode "${kind}" is reserved but not implemented in this pass.`);
    },
  };
}

export function resolveSessionProvider(env = {}) {
  const mode = normaliseEnvironmentMode(env);
  if (mode === 'development-stub') return createDevelopmentSessionProvider();
  if (mode === 'production') return createProductionSessionProvider();
  return createPlaceholderSessionProvider(mode);
}

export function createSessionAuthBoundary({ env = {}, sessionProvider } = {}) {
  const provider = sessionProvider || resolveSessionProvider(env);

  return {
    provider,
    describe() {
      return {
        mode: provider.kind,
        developmentStub: provider.kind === 'development-stub',
        productionReady: provider.kind === 'production',
      };
    },
    async getSession(request) {
      return provider.getSession(request, env);
    },
    async requireSession(request) {
      const session = await provider.getSession(request, env);
      if (!session) throw new UnauthenticatedError();
      return session;
    },
  };
}
