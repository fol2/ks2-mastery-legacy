import { json } from './http.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = Number(status) || 500;
    this.extra = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {};
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authenticated adult account required.', extra = {}) {
    super(401, message, {
      ok: false,
      code: 'unauthenticated',
      ...extra,
    });
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Learner access denied.', extra = {}) {
    super(403, message, {
      ok: false,
      code: 'forbidden',
      ...extra,
    });
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found.', extra = {}) {
    super(404, message, {
      ok: false,
      code: 'not_found',
      ...extra,
    });
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict.', extra = {}) {
    super(409, message, {
      ok: false,
      code: 'conflict',
      ...extra,
    });
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request.', extra = {}) {
    super(400, message, {
      ok: false,
      code: 'bad_request',
      ...extra,
    });
  }
}

export class BackendUnavailableError extends HttpError {
  constructor(message = 'Backend persistence is not configured.', extra = {}) {
    super(503, message, {
      ok: false,
      code: 'backend_unavailable',
      ...extra,
    });
  }
}

export class AuthConfigurationError extends HttpError {
  constructor(message = 'Production auth adapter is not configured.', extra = {}) {
    super(501, message, {
      ok: false,
      code: 'auth_not_implemented',
      ...extra,
    });
  }
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({
      ok: false,
      message: error.message,
      ...error.extra,
    }, error.status);
  }

  return json({
    ok: false,
    code: 'internal_error',
    message: error?.message || 'Unexpected server error.',
  }, 500);
}
