# KS2 Platform v2 — Pass 12 report

## Scope

This pass is **only** about building the first real SaaS operating surfaces on top of the hardened backend, permission model, and spelling content model.

It follows the already-established platform guarantees from:

- Pass 6 — subject runtime containment + golden-path smoke coverage
- Pass 7 — persistence honesty and degraded-state surfacing
- Pass 8 — real D1-backed Worker backend + learner ownership model
- Pass 9 — mutation safety, revisions, idempotency, and stale-write handling
- Pass 10 — English Spelling parity hardening and regression protection
- Pass 11 — versioned spelling content model with draft/published release rules

Those earlier passes remain the source of truth.
This pass does **not** add billing, messaging, marketing flows, a full CMS, or a production auth rollout.

## Goal

Build the first honest adult-facing vertical slices:

- a Parent Hub thin slice
- a minimal Admin / Operations skeleton

They must be role-aware, backed by durable platform data, and explicit about what is real versus what is still placeholder.

## Outcome

Result: **pass completed**

The repo now has the first real operating surfaces above the hardened backend.

What is now true:

- the shell has explicit **Parent Hub** and **Admin / Operations** routes
- parent/admin access is now a real, explicit permission line rather than an implied future concern
- adult accounts now carry a small `platform_role` alongside learner membership roles
- Parent Hub is backed by durable learner state, sessions, and events
- Admin / Operations is backed by durable spelling content, validation results, learner diagnostics, and mutation receipts
- the Worker exposes hub read-model endpoints instead of forcing these surfaces to scrape raw collections directly
- the read models reuse existing durable tables and repository data; no side reporting store was introduced
- the local reference build keeps these surfaces visible, but it stays honest about where Worker-backed data is not available yet

The current English Spelling PoC still works.
No pedagogy redesign was introduced.
No content-management logic was pushed into the spelling engine.
No hidden client-only dashboard state was used as the source of truth.

## What was built

## Parent Hub thin slice

Parent Hub now shows:

- learner overview
- due work / current focus
- recent sessions
- broad strengths
- broad weaknesses
- misconception patterns
- progress snapshot cards
- export entry points

Current spelling-backed source data:

- learner profile metadata
- `child_subject_state` spelling progress
- `practice_sessions`
- `event_log`
- published spelling runtime snapshot

The current Parent Hub read model is intentionally broad and summary-first.
It does not pretend to be a full reporting suite yet.

## Admin / Operations skeleton

Admin / Operations now shows:

- spelling content release status
- import / validation status
- audit-log lookup summary
- learner support / diagnostics entry points
- selected learner diagnostic snapshot

Current admin-backed source data:

- `account_subject_content`
- spelling content validation results
- `mutation_receipts`
- learner profiles + memberships
- the same learner summary read models used downstream for support diagnostics

This is intentionally a thin skeleton, not a complete back-office product.

## Access control is now explicit

There are now two role axes.

### Platform role

Stored on the adult account.

Current values:

- `parent`
- `admin`
- `ops`

Used for:

- Parent Hub access
- Admin / Operations access

### Learner membership role

Still stored on account-to-learner membership.

Current values:

- `owner`
- `member`
- `viewer`

Used for:

- learner read/write boundaries
- learner diagnostics visibility

### Current rules enforced in code

- Parent Hub requires platform role `parent`
- Parent Hub also requires readable learner membership (`owner`, `member`, or `viewer`)
- Admin / Operations requires platform role `admin` or `ops`
- Admin / Operations still respects learner membership when surfacing learner diagnostics
- Parent Hub and Admin / Operations are not treated as the same permission bucket

## Runtime data reuse instead of side stores

This pass deliberately **reused** the durable platform state that already exists.

No new dashboard-only storage layer was added.
No separate analytics cache was introduced.
No subject-owned reporting database was created.

The operating surfaces read from:

- learners
- generic subject state
- practice sessions
- event log
- account-scoped spelling content bundles
- mutation receipts

That keeps the repo aligned with the architecture shape established in the earlier hardening passes.

## Local reference build versus Worker path

A key honesty rule in this pass is that the repo must not imply more SaaS reality than it actually has.

### Local reference build

The browser still boots local-first.
The shell now includes visible Parent Hub and Admin / Operations routes.
A visible reference-role selector was added so the permission split can be inspected in the local build.

What is real locally:

- route surfaces
- read-model shape
- learner summary calculations
- content release summary
- import / validation summary
- learner support summary
- export entry points

What is still placeholder locally:

- mutation-receipt audit lookup

### Worker path

The Worker now exposes:

- `GET /api/hubs/parent?learnerId=...`
- `GET /api/hubs/admin?learnerId=...&requestId=...&auditLimit=...`

What is real there:

- platform-role enforcement
- learner membership checks
- spelling content release status from durable content bundles
- validation summary from durable content bundles
- audit lookup from durable mutation receipts
- learner diagnostics from durable learner/session/event data

## Read-model code added

Added:

- `src/platform/access/roles.js`
  - normalised platform roles and learner membership roles
  - explicit helpers for Parent/Admin access and learner mutation/read rules
- `src/subjects/spelling/read-model.js`
  - spelling learner summary model derived from progress, sessions, events, and runtime snapshot
- `src/platform/hubs/parent-read-model.js`
  - Parent Hub view model builder
- `src/platform/hubs/admin-read-model.js`
  - Admin / Operations view model builder
- `src/platform/hubs/api.js`
  - small API seam for future hub reads through the Worker boundary

## Schema / migration change

Added:

- `worker/migrations/0005_operating_surfaces.sql`

This introduces:

- `adult_accounts.platform_role`
- supporting indexes for mutation-receipt lookup and learner-session lookup

## Worker / repository changes

Updated:

- `worker/src/auth.js`
- `worker/src/repository.js`
- `worker/src/app.js`
- `tests/helpers/worker-server.js`

Key backend changes:

- development/test sessions can now carry `platformRole`
- hub reads are permission-checked at the Worker boundary
- parent/admin read models are assembled from durable repository data
- admin audit lookup reads from `mutation_receipts`
- readable learner memberships can now be used for diagnostics surfaces without widening learner write permissions
- `/api/session` and `/api/bootstrap` now expose the current platform role in the session payload

## Shell / UI changes

Updated:

- `src/platform/core/store.js`
- `src/main.js`
- `src/platform/ui/render.js`

What changed:

- new shell routes for `parent-hub` and `admin-hub`
- explicit entry points in the header
- local reference-role selector for inspection of permission splits
- Parent Hub cards for overview, focus, sessions, strengths/weaknesses, misconceptions, and export actions
- Admin / Operations cards for content release, validation, audit status, and learner diagnostics
- UI direction stayed close to the existing shell style

## Tests added

Added:

- `tests/hub-read-models.test.js`
- `tests/worker-hubs.test.js`

New coverage now proves:

- Parent Hub read-model correctness for due work, focus, recent sessions, strengths, weaknesses, and misconception patterns
- Admin read-model correctness for published release status, validation state, audit stream shape, and learner diagnostics
- Parent Hub Worker access requires the parent platform role plus readable learner membership
- Admin / Operations Worker access requires the admin or ops platform role
- admin audit summaries come from durable mutation receipts rather than client-only state

## Test result

Current suite result:

**77 / 77 tests passing**

## Docs updated

Added:

- `docs/operating-surfaces.md`
- `pass-12.md`

Updated:

- `README.md`
- `worker/README.md`
- `docs/ownership-access.md`
- `docs/repositories.md`

## Explicit real versus placeholder status

### Real in this pass

- Parent Hub route surface
- Admin / Operations route surface
- role-aware access rules
- Worker hub read endpoints
- spelling-backed learner summary read model
- content release status summary
- import / validation summary
- learner support / diagnostics summary
- audit lookup on the Worker path

### Still placeholder or intentionally thin

- local audit-log lookup in the browser reference build
- production auth rollout
- rich parent reporting suite
- rich admin tooling and editorial workflows
- live push-updating dashboards
- billing, messaging, or marketing surfaces
- broader multi-subject operating analytics beyond Spelling

## Important remaining limits

Still true after this pass:

1. the browser reference build still boots local-first
2. the local Admin / Operations surface is still a reference shell for some data, not a full Worker-backed admin console
3. audit lookup is only fully real on the Worker path in this pass
4. the adult-facing reporting surface is still spelling-first because English Spelling remains the only fully implemented subject
5. there is still no production auth rollout, invite flow, or full organisation model

## Why this pass is enough for now

This pass proves the hardened platform can carry adult-facing SaaS surfaces without breaking the architecture boundaries established in the earlier passes.

The spelling engine still owns pedagogy.
The content model still owns draft/publish/release rules.
The backend still owns access checks and durable mutation history.
The new hub surfaces only read from those boundaries.

That is the right shape for the first honest Parent/Admin vertical slices.
