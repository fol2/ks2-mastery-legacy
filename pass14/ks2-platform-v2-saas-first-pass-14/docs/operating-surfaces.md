# Operating surfaces: Parent Hub and Admin / Operations

This note describes the first thin SaaS operating surfaces added on top of the hardened backend, permission rules, and spelling content model.

The goal of this pass is not to build a full dashboard suite.
The goal is to prove that the platform can expose real read models for adult-facing surfaces without pushing reporting logic into subject engines or inventing separate side stores.

## Scope

This pass adds two read surfaces:

- **Parent Hub**
- **Admin / Operations**

They are intentionally thin.
They reuse the durable data already owned by the platform:

- learner profiles
- subject state
- practice sessions
- event log
- spelling content bundles
- mutation receipts

No extra reporting database, no client-only dashboard cache, and no subject-owned admin store were added.

## Role model

There are now two separate permission lines.

### Platform role

Stored at the account level.

Current values:

- `parent`
- `admin`
- `ops`

These roles answer questions like:

- can this account open Parent Hub?
- can this account open Admin / Operations?

### Learner membership role

Stored at the account-to-learner membership level.

Current values:

- `owner`
- `member`
- `viewer`

These roles answer questions like:

- can this account read this learner?
- can this account write learner-scoped data?
- can this learner appear in diagnostics?

The two axes are deliberate.
A platform admin role does not erase learner membership checks, and a parent role does not unlock admin surfaces.

## Parent Hub

Parent Hub is a learner-facing adult read model.
It currently shows:

- learner overview
- due work / current focus
- recent sessions
- broad strengths
- broad weaknesses
- misconception patterns
- progress snapshot cards
- export entry points

### Current data source

Parent Hub is built from the durable spelling learner state:

- spelling progress map inside `child_subject_state`
- recent spelling sessions inside `practice_sessions`
- spelling retry / correction signals inside `event_log`
- the currently published spelling runtime snapshot

### Current permission rule

Parent Hub requires:

- platform role `parent`
- readable learner membership (`owner`, `member`, or `viewer`)

That keeps the surface explicitly separate from Admin / Operations.

## Admin / Operations

Admin / Operations is a thin operator skeleton.
It currently shows:

- spelling content release status
- draft import / validation status
- mutation-receipt audit lookup
- admin-only account role management
- learner diagnostics entry points
- selected learner support summary

### Current data source

Admin / Operations reuses:

- `account_subject_content`
- spelling content validation results
- `mutation_receipts`
- `adult_accounts.platform_role`
- learner profiles + memberships
- learner spelling read models for support diagnostics

### Current permission rule

Admin / Operations requires:

- platform role `admin` or `ops`

This surface is not available to `parent` accounts.

Account role management inside Operations is narrower:

- listing and changing adult account roles requires platform role `admin`
- `ops` can open Operations, but cannot change account roles
- the Worker blocks demoting the last remaining admin
- role changes are written to `adult_accounts.platform_role`
- role changes are recorded in `mutation_receipts`

## Local reference build versus Worker API

There are two ways these surfaces currently appear.

### Local reference build

The browser shell now includes route entry points for Parent Hub and Admin / Operations.
Those views are intentionally honest reference surfaces.

What is real locally:

- read-model shape
- role-aware rendering
- learner summary calculations
- content release / validation summary
- export entry points

What is still placeholder locally:

- mutation-receipt audit lookup

The local build exposes a visible role switcher so the permission rules can be inspected without pretending local-first boot is a finished SaaS session model.

### Worker API path

The Worker now exposes:

- `GET /api/hubs/parent?learnerId=...`
- `GET /api/hubs/admin?learnerId=...&requestId=...&auditLimit=...`
- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/role`

What is real there:

- platform-role enforcement
- learner membership checks
- admin-only account role management
- content release / validation summary from durable content
- audit lookup from durable mutation receipts
- learner diagnostics backed by durable learner data

## Read-model boundaries

The important boundary rule is unchanged:

- subject engines own pedagogy and session transitions
- repositories own durable state transport
- read models own adult-facing summaries

The spelling engine does **not** own Parent Hub or Admin logic.
The hub read models consume durable records after the fact.

## What is real in this pass

### Real now

- route-level Parent Hub and Admin / Operations surfaces in the shell
- explicit platform roles and helper rules
- Worker-backed hub endpoints
- signed-in Parent Hub and Admin / Operations loading live Worker hub payloads
- adult-surface learner selection across readable memberships, including viewers
- parent/admin permission tests
- spelling-backed learner summary read model
- admin-only account role assignment backed by D1
- content release status read model
- import / validation summary read model
- audit lookup backed by mutation receipts on the Worker path
- learner support / diagnostics summary

### Still intentionally thin or placeholder

- no billing, messaging, or marketing surfaces
- no full parent reporting suite
- no editorial CMS
- no heavy cross-subject analytics warehouse
- no push-updating dashboards
- no worker-backed audit search UI beyond basic lookup output
- no invite flow, organisation model, or rich admin account management beyond basic platform-role assignment
- no viewer learner switch inside the main writable bootstrap shell yet; readable viewer selection lives in Parent Hub and Admin / Operations only

## Why this pass stops here

This pass proves the platform can carry adult-facing operating surfaces without collapsing back into subject-specific code blobs or client-only dashboards.

That is enough for the first honest vertical slice.
The next richer reporting work should extend these read models instead of bypassing them.
