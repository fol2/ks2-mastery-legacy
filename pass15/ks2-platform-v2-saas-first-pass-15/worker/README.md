# Worker minimum viable backend

This Worker is now a real minimum viable backend for the generic repository contract.

Production browser sessions use the API-backed repository after sign-in.
Direct file/local mode, or `?local=1`, still uses browser storage for development.
English Spelling still runs through the same subject/service boundary.
The Worker now provides durable D1-backed storage for the generic platform collections, account-scoped spelling content, session/auth flows, OpenAI TTS proxying, learner ownership at the API boundary, and thin hub read-model routes for Parent Hub / Admin.

## What this Worker is now

It is:

- a D1-backed repository backend for the shared platform contract
- account-scoped spelling content storage for draft and published release bundles
- an adult-account to learner ownership boundary
- a place where learner-scoped permissions are enforced before repository writes happen
- a provider-agnostic auth/session seam with production email and social login flows plus a safe development/test stub
- a Worker-side TTS proxy that keeps the OpenAI API key out of the browser
- a read-model boundary for role-aware Parent Hub and Admin / Operations surfaces
- an admin-only account role management boundary for production platform roles
- a deployment boundary that still keeps subject UI rules out of the backend

## What it still is not

It is not yet:

- a billing system
- an invite / acceptance flow
- a full parent/admin application suite
- a messaging system
- an automatic merge layer for concurrent edits
- a background retry / replay scheduler
- a finished Durable Object coordination layer

## Minimal SaaS domain model

### `platform_role`

Adult accounts carry a small platform role.

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
- the learner rows consumed by the shared browser shell

### `account_learner_memberships`

The ownership and membership table.

Roles are intentionally small:

- `owner`
- `member`
- `viewer`

Current browser-backed repository flows only surface writable learners (`owner` / `member`) because the shell does not yet have read-only learner UX.
`viewer` can be used by explicit diagnostics/read surfaces, but it is not surfaced through the main learner bootstrap flow yet.

### Learner-scoped collections

These remain generic and subject-agnostic:

- `child_subject_state`
- `practice_sessions`
- `child_game_state`
- `event_log`

Nothing in the schema is Spelling-shaped.

### Account-scoped subject content

`account_subject_content` stores versioned subject content bundles by account and subject.

Current use:

- `subject_id = "spelling"`
- operators edit the draft bundle through the thin settings UI or import/export scripts
- learner runtime reads only the current published release snapshot
- writes use the same account revision and request-receipt policy as learner-profile writes

## Current mutation safety rules

The Worker now enforces a small mutation policy instead of last-write-wins.

- account-scoped writes use `adult_accounts.repo_revision`
- learner-scoped writes use `learner_profiles.state_revision`
- every write requires a mutation `requestId`
- retries with the same request id and the same payload replay the stored response
- reusing the same request id for different payloads is rejected with `409 idempotency_reuse`
- stale writes are rejected with `409 stale_write`
- the browser API adapter rebases queued local operations over the latest remote revision before retrying stale writes
- there is no hidden server-side merge

That keeps the backend honest for multiple tabs, devices, retries, and interrupted requests without pretending we have real-time merge machinery.

## Hub read-model routes

The Worker exposes two thin read-model routes.

- `GET /api/hubs/parent?learnerId=...`
- `GET /api/hubs/admin?learnerId=...&requestId=...&auditLimit=...`

Current behaviour:

- Parent Hub requires platform role `parent` plus readable learner membership
- Admin / Operations requires platform role `admin` or `ops`
- both routes reuse durable learner/content/event data instead of separate dashboard tables
- audit lookup is backed by `mutation_receipts`
- content release status is backed by `account_subject_content`

These routes are intentionally read-only operating surfaces, not a full back-office system.

The Worker also exposes an admin-only role management slice.

- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/role`

Current behaviour:

- only platform role `admin` can list accounts or change account platform roles
- `ops` can open Operations, but cannot manage account roles
- the Worker blocks demoting the last remaining admin
- role changes write `adult_accounts.platform_role`
- role changes are idempotent by request id and recorded in `mutation_receipts`

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
  - reads `x-ks2-dev-account-id`, optional development profile headers, and optional `x-ks2-dev-platform-role`
- `production`
  - reads the signed session cookie or bearer token
  - resolves the adult account and platform role from D1-backed session tables

This keeps production auth explicit while still letting the backend contract be tested end-to-end with a safe development stub.

## Important architectural rule

The Worker provides repositories, account scope, and access checks.

It must not become the place where subject pedagogy, subject rendering assumptions, reward presentation, or shell routing rules live.

## Conflict / coordination status

This Worker currently relies on database compare-and-swap plus request receipts.
That is enough for the current MVP because each write is still a single bounded mutation.

A Durable Object layer is still deferred.
If it becomes necessary later, it should stay narrow and learner-scoped rather than becoming a general-purpose app runtime.
