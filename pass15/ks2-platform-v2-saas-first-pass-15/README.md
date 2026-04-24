# KS2 Mastery Platform v2

This repository is a ground-up rebuild of the KS2 proof of concept.

The goal is not to polish the old prototype. The goal is to give the product a stable base that can carry all six KS2 exam subjects without turning English Spelling into a permanent special case.

## What is inside

- `index.html` and `styles/app.css`
  - A dependency-light shell that preserves the current visual direction.
- `src/platform/*`
  - Shared platform concerns: route state, learner profiles, subject registry, repository boundary, reward layer, shared rendering.
  - The subject registry now validates the module contract at startup so boundary mistakes fail early instead of surfacing as mid-render crashes.
  - The shared store now persists learners and subject UI through explicit repository contracts instead of writing directly to browser storage.
- `src/subjects/spelling/*`
  - The rebuilt English Spelling slice.
  - The legacy spelling engine is preserved and wrapped behind a clean service.
  - The spelling service now owns an explicit serialisable state contract, deterministic transitions, resume-safe restoration, and domain-event emission.
  - Spelling content now has a versioned draft/published content model. Learner runtime reads are pinned to the published release snapshot, not live draft rows.
- `src/subjects/placeholders/*`
  - Clean extension slots for Arithmetic, Reasoning, Grammar, Punctuation and Reading.
- `worker/*`
  - A Cloudflare-friendly backend with D1-backed repository routes, account-scoped spelling content, learner ownership checks, production sessions, Worker-side OpenAI TTS proxying, and thin Parent/Admin hub routes.
- `docs/*`
  - Audit, architecture, refactor plan, migration map, repository notes, ownership/access notes, state-integrity notes, spelling-service and spelling-content notes, a direct spelling parity audit, operating-surface notes, and the subject-expansion readiness gate.
- `tests/*`
  - Node tests covering the spelling service, reward events, shared store, repository parity, state recovery, import/export round-trips including legacy spelling progress imports, subject runtime containment, hub read models, Worker access, TTS, auth, golden-path smoke flows, and reusable subject-expansion conformance.

## Status

English Spelling works in the new structure.

Production on `ks2.eugnel.uk` uses the API adapter by default after sign-in. Direct file/local mode, or `?local=1`, still uses browser storage for development only. The API adapter reports explicit persistence modes (`local-only`, `remote-sync`, `degraded`) so failed remote writes are visible instead of being treated as silent success. The Worker is D1-backed with learner ownership enforcement, atomic account / learner revision checks, idempotent request replay, account-scoped spelling content routes, role-aware Parent/Admin hub read routes, and OpenAI TTS as the production dictation default.

The repo now has a reusable subject-expansion harness and an explicit expansion-readiness gate. The gate is a narrow **GO** for the first Arithmetic thin slice only; it is not a claim that the full multi-subject SaaS is finished.

The other five subjects are intentionally placeholders. They already have:

- subject identities
- dashboard cards
- subject tabs
- analytics slots
- settings slots
- learner hooks
- reward-layer hooks
- Cloudflare deployment and API boundaries

What they do not have yet is their own deterministic learning engine. That is deliberate.

## Quick start

### Open in a browser

You can open `index.html` directly, or serve the folder statically.

### Run tests

```bash
npm test
```

### Build and deploy

```bash
npm run check
npm run db:migrate:remote
npm run deploy
```

The Cloudflare scripts run Wrangler through `scripts/wrangler-oauth.mjs`, which deliberately removes `CLOUDFLARE_API_TOKEN` for that child process. This keeps deploys and remote D1 commands on the logged-in OAuth session even when the parent shell still has an old API token exported. The legacy `*:oauth` aliases remain for muscle memory, but the default scripts are already OAuth-safe.

## Core rebuild decisions

1. Subject engines are separate from the shell.
2. The game layer reacts to mastery instead of controlling learning flow.
3. Learner profiles belong to the platform, not to a single subject.
4. The spelling engine is preserved where it still adds value.
5. The real persistence boundary is a repository contract, not raw browser storage.
6. Persisted data is versioned and normalised at the repository boundary before the shell or subjects consume it.
7. Cloudflare deployment is treated as an adapter boundary, not as the application architecture itself.

## Current operating surfaces

The shell now has two explicit adult-facing routes:

- **Parent Hub**
  - learner overview
  - due work / current focus
  - recent sessions
  - broad strengths / weaknesses
  - misconception patterns
  - export entry points
- **Operations**
  - content release status
  - import / validation summary
  - audit lookup status
  - admin-only account role management
  - learner diagnostics entry points

These are intentionally thin.
They reuse durable platform data and keep reporting logic out of the spelling engine.
On the signed-in Worker path, Parent Hub and Operations now read live hub payloads and can select readable owner / member / viewer learners separately from the writable learner bootstrap. The main subject shell still stays writable-only.
Signed-in zero-writable accounts are now routed explicitly instead of falling through the dashboard shell: viewer-only parents land in Parent Hub, admin / ops accounts land in Operations, and a brand-new parent with no learner gets a first-learner onboarding form that creates a real writable learner through the existing learners boundary.
The local reference build includes visible role switching for inspection; the Worker path provides permission-checked hub endpoints and D1-backed account role changes.

## Subject expansion gate

Pass 13 turns "add a second subject" into a controlled engineering change.

- `tests/helpers/subject-expansion-harness.js` provides reusable conformance and golden-path smoke suites.
- `tests/helpers/expansion-fixture-subject.js` is a non-production fixture proving the shell can carry a second deterministic thin slice.
- `tests/subject-expansion.test.js` runs the same acceptance path against English Spelling and the fixture.
- `docs/subject-expansion.md` defines the add-a-subject checklist.
- `docs/expansion-readiness.md` records the narrow GO decision for the future Arithmetic thin slice.

The fixture is not a shipped product subject, and Arithmetic is still intentionally not implemented in this pass.

## Important note

This reference rebuild is deliberately light on framework machinery. It is easier to inspect, easier to continue, and clearer as an architectural handoff.

If the next team wants to move the shell back onto React, the boundaries are now clean enough to do that without rewriting the spelling engine again.
