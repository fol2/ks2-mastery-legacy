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
  - Spelling content now lives in a versioned draft/published release model, and runtime reads stay pinned to published snapshots.
- `src/subjects/placeholders/*`
  - Clean extension slots for Arithmetic, Reasoning, Grammar, Punctuation and Reading.
- `worker/*`
  - A Cloudflare-friendly minimum viable backend with D1-backed repository routes, learner ownership checks, and a provider-agnostic auth/session seam.
- `docs/*`
  - Audit, architecture, refactor plan, migration map, repository notes, ownership/access notes, state-integrity notes, a dedicated spelling-service contract note, a direct spelling parity audit, spelling content-model notes, and operating-surface notes for Parent Hub / Admin.
- `tests/*`
  - Node tests covering the spelling service, reward events, shared store, repository parity, state recovery, import/export round-trips, subject runtime containment, and golden-path smoke flows.

## Status

English Spelling works in the new structure.

The browser reference build still boots local-first. The API adapter reports explicit persistence modes (`local-only`, `remote-sync`, `degraded`) so failed remote writes are visible instead of being treated as silent success. The Worker is now a real D1-backed minimum backend with learner ownership enforcement, atomic account / learner revision checks, idempotent request replay for interrupted writes, an account-scoped spelling-content store, and thin hub read-model routes for Parent Hub / Admin-style surfaces. Production auth rollout, automatic merge, full dashboard suites, and broader SaaS operations are still deferred.

The other five subjects are intentionally placeholders. They already have:

- subject identities
- dashboard cards
- subject tabs
- analytics slots
- settings slots
- learner hooks
- reward-layer hooks
- Cloudflare API placeholders

What they do not have yet is their own deterministic learning engine. That is deliberate.

## Quick start

### Open in a browser

You can open `index.html` directly, or serve the folder statically.

### Run tests

```bash
npm test
```

### Spelling content tooling

```bash
npm run content:seed
npm run content:validate
npm run content:generate
npm run content:export
npm run content:import -- ./some-export.json
```

`content/spelling.seed.json` is the editable source bundle.
The generated runtime modules stay downstream from the currently published release snapshot inside that bundle.

## Core rebuild decisions

1. Subject engines are separate from the shell.
2. The game layer reacts to mastery instead of controlling learning flow.
3. Learner profiles belong to the platform, not to a single subject.
4. The spelling engine is preserved where it still adds value.
5. The real persistence boundary is a repository contract, not raw browser storage.
6. Persisted data is versioned and normalised at the repository boundary before the shell or subjects consume it.
7. Cloudflare deployment is treated as an adapter boundary, not as the application architecture itself.

## Current operating surfaces

This pass adds two explicit adult-facing routes in the shell:

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
  - learner diagnostics entry points

These are intentionally thin.
They reuse durable platform data and keep reporting logic out of the spelling engine.
The local reference build includes visible role switching for inspection; the Worker path provides the real permission-checked hub endpoints.

## Important note

This reference rebuild is deliberately light on framework machinery. It is easier to inspect, easier to continue, and clearer as an architectural handoff.

If the next team wants to move the shell back onto React, the boundaries are now clean enough to do that without rewriting the spelling engine again.
