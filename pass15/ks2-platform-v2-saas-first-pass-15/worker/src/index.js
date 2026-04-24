import { createWorkerApp } from './app.js';
import { json } from './http.js';

export class LearnerLock {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, durableObject: 'LearnerLock' });
    }
    return json({
      ok: false,
      status: 'not_implemented',
      message: 'LearnerLock remains a future coordination hook for per-learner mutation serialisation.',
    }, 501);
  }
}

const app = createWorkerApp();

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
