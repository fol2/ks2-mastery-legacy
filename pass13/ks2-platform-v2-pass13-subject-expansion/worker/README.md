# Worker minimum viable backend

This Worker is now a real minimum viable backend for the generic repository contract.

The browser reference build still boots local-first.
English Spelling still runs through the same subject/service boundary.
The Worker now provides durable D1-backed storage for the generic platform collections and enforces learner ownership at the API boundary.
It also now provides an account-scoped spelling-content boundary with explicit draft/publish/release storage, plus thin hub read-model routes for Parent Hub and Admin / Operations.

## What this Worker is now

It is:

- a D1-backed repository backend for the shared platform contract
- an adult-account to learner ownership boundary
- a place where learner-scoped permissions are enforced before repository writes happen
- a provider-agnostic auth/session seam with a safe development/test stub
- a deployment boundary that still keeps subject UI rules out of the backend

## What it still is not

It is not yet:

- a production auth rollout
- a billing system
- an invite / acceptance flow
- a full parent/admin application suite
- a messaging system
- an automatic merge layer for concurrent edits
- a background retry / replay scheduler
- a finished Durable Object coordination layer

## Minimal SaaS domain model

### `platform_role`

Adult accounts now also carry a small platform role.

Current values:

- `parent`
- `admin`
- `ops`

This role is separate from learner membership.
It controls which adult-facing hub surfaces are available.


### `adult_accounts`

Stable adult-account rows keyed by the auth/session boundary.

Used for:

- repository account scope
- account-level selected learner
- future account settings

### `learner_profiles`

Platform-owned child learner records.

Used for:

- learner identity
- year group / goal / avatar metadata
- the learner rows already consumed by the local-first browser shell

### `account_learner_memberships`

The ownership and membership table.

Roles are intentionally small:

- `owner`
- `member`
- `viewer`

Current browser-backed repository flows only surface writable learners (`owner` / `member`) because the shell does not yet have read-only learner UX.
`viewer` is reserved for future shared access flows.

### Learner-scoped collections

These remain generic and subject-agnostic:

- `child_subject_state`
- `practice_sessions`
- `child_game_state`
- `event_log`

Nothing in the schema is Spelling-shaped.

### Account-scoped subject content

There is now one account-scoped subject-content table:

- `account_subject_content`

Current use:

- stores the versioned English Spelling content bundle
- keeps draft rows, immutable published releases, and the publication pointer together in one validated bundle
- remains account-scoped rather than learner-scoped because this is operator/admin content, not learner progress

Current content routes:

- `GET /api/content/spelling`
- `PUT /api/content/spelling`

Those routes still sit behind the same account revision / idempotency mutation policy already used for other account-scoped writes.

## Current mutation safety rules

The Worker now enforces a small mutation policy instead of last-write-wins.

- account-scoped writes use `adult_accounts.repo_revision`
- learner-scoped writes use `learner_profiles.state_revision`
- every write requires a mutation `requestId`
- retries with the same request id and the same payload replay the stored response
- reusing the same request id for different payloads is rejected with `409 idempotency_reuse`
- stale writes are rejected with `409 stale_write`
- there is no hidden server-side merge

That keeps the backend honest for multiple tabs, devices, retries, and interrupted requests without pretending we have real-time merge machinery.

## Hub read-model routes

The Worker now exposes two thin read-model routes.

- `GET /api/hubs/parent?learnerId=...`
- `GET /api/hubs/admin?learnerId=...&requestId=...&auditLimit=...`

Current behaviour:

- Parent Hub requires platform role `parent` plus readable learner membership
- Admin / Operations requires platform role `admin` or `ops`
- both routes reuse durable learner/content/event data instead of separate dashboard tables
- audit lookup is backed by `mutation_receipts`
- content release status is backed by `account_subject_content`

These are intentionally read-only operating surfaces, not a full back-office system.

## Current access rules

- every repository route except `/api/health` requires an authenticated adult session
- the development/test auth stub is enabled only through the explicit development auth mode
- bootstrap only returns learners the current account can actively work with now
- learner-scoped writes require `owner` or `member`
- deleting or omitting a learner is ownership-aware
- if the last owner removes themselves from a shared learner, an existing member is promoted so the learner is not orphaned
- account-scoped debug reset only clears the current account scope; it does not wipe unrelated tenant data

## Auth/session boundary

The session boundary is provider-agnostic.

In this pass there are only two concrete states:

- `development-stub`
  - safe for local development and automated tests
  - reads `x-ks2-dev-account-id` and optional development profile headers
- production placeholders
  - explicit non-implemented adapters for real production rollout later

This avoids inventing home-grown production auth while still letting the backend contract be tested end-to-end now.

## Important architectural rule

The Worker provides repositories, account scope, and access checks.

It must not become the place where subject pedagogy, subject rendering assumptions, reward presentation, or shell routing rules live.

## Conflict / coordination status

This Worker currently relies on database compare-and-swap plus request receipts.
That is enough for the current MVP because each write is still a single bounded mutation.

A Durable Object layer is still deferred.
If it becomes necessary later, it should stay narrow and learner-scoped rather than becoming a general-purpose app runtime.
