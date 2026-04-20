# Backend ownership and access rules

This note describes the minimum ownership model introduced for the Worker-backed repository path.

## Scope

The goal is not to build a complete SaaS account system in one pass.
The goal is to make the backend durable, account-scoped, and honest before any multi-subject expansion.

## Domain model

### Platform role

Adult accounts now also carry a small platform role.

Current values:

- `parent`
- `admin`
- `ops`

This role is separate from learner membership.
It is used for adult-facing hub permissions rather than learner-state write permissions.


### Adult account

An adult account is the authenticated top-level owner context for repository access.

Current durable row:

- `adult_accounts`

Key fields:

- `id`
- `email`
- `display_name`
- `selected_learner_id`
- timestamps

The account row is intentionally small.
Identity linking across multiple auth providers is deferred.

### Learner profile

A learner profile is a child record owned through account membership, not by a subject module.

Current durable row:

- `learner_profiles`

Key fields mirror the existing shared learner contract already used locally:

- `id`
- `name`
- `year_group`
- `avatar_color`
- `goal`
- `daily_minutes`
- timestamps

### Account-to-learner membership

Ownership and sharing sit in:

- `account_learner_memberships`

Current roles are intentionally small:

- `owner`
- `member`
- `viewer`

## Permission rules in this pass

### `owner`

Can:

- read and write learner-scoped repository collections
- remove the learner from their own scope
- act as the durable owner for future shared flows

### `member`

Can:

- read and write learner-scoped repository collections

Cannot yet:

- manage memberships through any public API surface

### `viewer`

Can:

- read learner-scoped data for explicit adult-facing diagnostics surfaces

Cannot yet:

- write learner-scoped repository collections
- participate in the current main learner bootstrap flow used by the local-first shell

The current browser bootstrap still surfaces writable learners only.
Viewer access is currently used for permission-correct hub reads rather than full learner-switch UX.

## Repository access behaviour

- repository routes require an authenticated adult session
- bootstrap is account-scoped, not global
- learner writes are checked against account membership
- subject state, sessions, game state, and events are all learner-scoped and permission-checked at the API boundary
- the current browser repository client only works with writable learners, so bootstrap returns the writable learner set for now
- Parent Hub reads can use readable learner memberships (`owner`, `member`, `viewer`) when the platform role is `parent`
- Admin / Operations reads require platform role `admin` or `ops` and still respect learner membership when surfacing learner diagnostics

## Ownership-safe removal rule

When an `owner` removes a learner from their current snapshot:

- if no other membership exists, the learner is deleted
- if another owner exists, the current owner membership is removed
- if only members remain, one member is promoted to owner before the current owner is removed

That keeps shared learners from becoming ownerless without requiring a full invite system in this pass.

## Explicitly deferred

Still deferred after this pass:

- production auth rollout
- provider account linking / merging
- invites and acceptance flows
- billing
- messaging
- read-only viewer UX in the browser shell
- conflict resolution and multi-client merge policy
