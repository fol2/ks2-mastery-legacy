# Codebase audit

## Scope reviewed

I reviewed two source snapshots:

1. The original English Spelling proof of concept in `ks2_english_spelling/preview.html`.
2. The newer `ks2-mastery-pure-codebase-optimised-20260419-221459` codebase with a Cloudflare Worker, D1, Durable Object locking, and a bundled client shell.

## What the current product is doing well

The project is already beyond a toy prototype in a few important ways.

- The newer codebase has a real server boundary in `worker/routes/*` and `worker/services/*`.
- It has proper child profiles and authenticated sessions.
- It reuses the spelling engine on the server through `worker/lib/spelling-service.js` instead of throwing the logic away.
- It already has a separate game presentation layer in files such as `src/monster-overlay.jsx`, `src/collection.jsx` and `src/word-spirit.jsx`.
- It includes real tests in `test/unit/*` and `test/integration/*`.
- The UI direction is coherent. The warm palette, serif headings, soft cards, and creature layer already feel like the product identity.

Those parts are worth keeping.

## How the older Spelling PoC works

The older PoC is a giant single-file app in `preview.html`.

It contains all of these concerns in one place:

- content loading
- scheduling
- marking
- session flow
- progress persistence
- speech hooks
- dashboard UI
- summary UI
- shortcuts and event wiring

That file still contains the real value of the spelling product: the learning loop and the engine behaviour. It is also exactly why the code became fragile. Every change is forced through one dense, implicit runtime.

The included `README_audit_tightened.txt` shows the kind of maintenance pressure the file was already under: SATs-mode leakage fixes, progress bar bugs, timer cleanup, shortcut additions, and repeated UI wiring clean-up.

## How the newer codebase works

The newer codebase is materially better than the old single-file PoC.

### Frontend delivery

The frontend uses Vite only as a delivery wrapper. `scripts/build-public.mjs` concatenates many client files into `src/generated/legacy-entry.generated.jsx`, injects React on `window`, and then `src/main.jsx` imports that one generated file.

That means the frontend is still operating like a global-script application, just with a bundler in front of it.

### Runtime shape

The client is composed from files such as:

- `src/app.jsx`
- `src/dashboard.jsx`
- `src/practice.jsx`
- `src/spelling-api.jsx`
- `src/spelling-dashboard.jsx`
- `src/spelling-game.jsx`
- `src/spelling-summary.jsx`

The visible product flow is broadly:

1. Boot shell.
2. Load user and child bootstrap data.
3. Show subject dashboard.
4. Open the spelling slice.
5. Start or resume a spelling session.
6. Submit answers through the API.
7. Update progress and monster state.
8. Show a summary and collection feedback.

### Server shape

The Worker side is stronger.

- `worker/lib/store.js` manages users, child rows, child state and spelling sessions.
- `worker/lib/spelling-service.js` wraps the legacy spelling engine and builds API payloads.
- `worker/durable/spelling-lock.js` serialises per-child spelling mutations to prevent race conditions.
- `migrations/0001_initial_schema.sql` and `0002_request_limits.sql` define the current D1 schema.

This is already a meaningful SaaS foundation, but it is still spelling-centric rather than platform-centric.

## Why the current codebase still feels fragile

### 1. The frontend is modular by file, not by boundary

The build step generates one global entry file from a hard-coded file order. That means load order is part of the architecture.

When a system relies on a hidden concatenation order, every extension becomes riskier than it should be.

### 2. Globals are still the integration mechanism

A lot of frontend communication still happens through `window.*` assignments and globally discoverable helpers rather than explicit imports and contracts.

That makes features easy to bolt on once, but difficult to reason about later.

### 3. Spelling is still a special case inside the shell

`src/practice.jsx` branches directly on `subject.id === 'spelling'`.

That is the clearest sign that the app is not yet truly a multi-subject platform. It is a spelling product with subject placeholders around it.

### 4. Build drift is already visible

There is an orphaned `src/monster-engine.jsx` file that is not even included in the `clientSourceFiles` list inside `scripts/build-public.mjs`.

That is exactly the kind of drift that appears when the real architecture is implicit.

### 5. Data modelling does not scale cleanly to six subjects

`worker/lib/store.js` currently keeps subject state in specific JSON columns such as:

- `spelling_progress_json`
- `monster_state_json`
- `spelling_prefs_json`

That works for one implemented subject. It becomes awkward and brittle when each new subject needs another cluster of subject-named columns.

### 6. Response-shape mutation is happening inside services

`worker/services/bundle-patches.js` updates already-built bootstrap payload shapes after writes, instead of making reads the single source of truth.

That is convenient in the short term, but it couples persistence logic tightly to transport-shape logic.

### 7. Game logic and learning logic are still too entangled in practice flow

The direction is right, but the actual event boundaries are still soft. Monster updates, answer grading, overlay state and practice state still bleed into each other through runtime events and shared globals.

The product vision says they should compound each other without overlapping. The codebase has not fully caught up to that idea yet.

## What should be preserved

### Keep

- the visual direction
- the current subject dashboard feel
- the creature / codex layer as the reward skin
- the deterministic spelling engine behaviour
- the word data and sentence banks
- the current Cloudflare-friendly mindset
- the Durable Object locking idea for per-learner mutations

### Replace or redesign

- generated global frontend entry
- `window`-driven client integration
- subject-specific data columns for long-term state growth
- spelling special-casing in shared shell components
- build order as hidden architecture
- mixed UI + engine + persistence boundaries

## Bottom line

The current project is not failing because it lacks features.

It is failing because the application identity and the platform identity are still partially merged.

You already have a solid spelling engine and a promising UX direction. What you need is a platform contract that makes those strengths portable.
