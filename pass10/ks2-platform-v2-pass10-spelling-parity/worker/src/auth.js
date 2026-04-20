import { AuthConfigurationError, UnauthenticatedError } from './errors.js';

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normaliseEnvironmentMode(env = {}) {
  const explicit = cleanText(env.AUTH_MODE);
  if (explicit) return explicit;
  const stage = String(env.ENVIRONMENT || env.NODE_ENV || '').trim().toLowerCase();
  if (stage === 'development' || stage === 'dev' || stage === 'test') return 'development-stub';
  return 'production-placeholder';
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
        provider: 'development-stub',
        sessionId: `dev:${accountId}`,
      };
    },
  };
}

export function createPlaceholderSessionProvider(kind = 'production-placeholder') {
  return {
    kind,
    async getSession() {
      throw new AuthConfigurationError(`Auth mode \"${kind}\" is reserved but not implemented in this pass.`);
    },
  };
}

export function resolveSessionProvider(env = {}) {
  const mode = normaliseEnvironmentMode(env);
  if (mode === 'development-stub') return createDevelopmentSessionProvider();
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
        productionReady: false,
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
