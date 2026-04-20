# Backend ownership and access rules

This note describes the minimum ownership model introduced for the Worker-backed repository path.

## Scope

The goal is not to build a complete SaaS account system in one pass.
The goal is to make the backend durable, account-scoped, and honest before any multi-subject expansion.

## Domain model

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

Reserved for future read-only sharing.
The current browser shell does not expose read-only learner UX, so viewer learners are not surfaced through the current repository bootstrap path.

## Repository access behaviour

- repository routes require an authenticated adult session
- bootstrap is account-scoped, not global
- learner writes are checked against account membership
- subject state, sessions, game state, and events are all learner-scoped and permission-checked at the API boundary
- the current browser repository client only works with writable learners, so bootstrap returns the writable learner set for now

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
