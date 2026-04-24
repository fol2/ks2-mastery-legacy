# Mutation and conflict policy

## Why this exists

The minimum backend is no longer only about storing rows.
It must now behave safely when the same learner is touched by more than one tab, device, retry, or interrupted request.

The policy in this pass is intentionally small and explicit:

- optimistic client writes stay fast
- every write carries an expected revision
- every write carries an idempotency request id
- stale writes are rejected, not auto-merged
- retry / resync is explicit and bounded

## Scope model

There are two revision scopes.

### Account scope

Uses `adult_accounts.repo_revision`.

This scope covers mutations that change the account-owned learner bundle, such as:

- `PUT /api/learners`
- `POST /api/debug/reset`

This keeps learner ordering, selected learner, learner creation, learner removal, and account membership edits on one explicit account revision line.

### Learner scope

Uses `learner_profiles.state_revision`.

This scope covers all learner-owned collections:

- `child_subject_state`
- `practice_sessions`
- `child_game_state`
- `event_log`
- learner-scoped clears / resets / destructive actions on those collections

This is deliberately conservative.
The platform does **not** try to merge separate learner records independently yet.
If two clients touch different learner-scoped collections for the same learner at the same time, they still compete on the same learner revision.
That is simpler, explicit, and safe for the current MVP.

## Mutation envelope

Every write route now requires mutation metadata.

```txt
requestId
correlationId
expectedAccountRevision | expectedLearnerRevision
```

Rules:

- `requestId` is required for every write
- `correlationId` is diagnostic and should stay stable across retries of the same logical write
- account-scoped writes must send `expectedAccountRevision`
- learner-scoped writes must send `expectedLearnerRevision`

## Atomic compare-and-swap

Revision checks are enforced in the database, not only in application logic.

A mutation succeeds only if the current scope revision still matches the expected revision.
The Worker performs an atomic conditional update:

- account scope: `WHERE repo_revision = expected`
- learner scope: `WHERE state_revision = expected`

If that conditional update affects zero rows, the write is rejected as stale.
No server-side merge is attempted.

On success:

- the scope revision increments by 1
- the write is applied in the same transaction
- the response includes `mutation.appliedRevision`

## Idempotency receipts

Retryable write operations are protected by request receipts stored in `mutation_receipts`.

Receipt key:

- `account_id`
- `request_id`

The Worker stores:

- mutation kind
- scope type / scope id
- stable payload hash
- response payload
- status code
- correlation id
- applied time

### Replay rule

If the same `requestId` arrives again with the **same** payload hash:

- the mutation is **not** applied twice
- the previously stored response is replayed
- the response is marked `mutation.replayed = true`

This is what makes interrupted requests safe enough to retry.

### Reuse rule

If the same `requestId` arrives again with a **different** payload hash:

- the request is rejected with `409 idempotency_reuse`

That prevents a retry token from silently becoming a different mutation.

## Collection semantics

### `child_subject_state`

Mutation style:

- whole-record replace for one `(learnerId, subjectId)`
- or explicit clear

Conflict rule:

- learner-scoped compare-and-swap
- stale write returns `409 stale_write`

Trusted semantics:

- the whole generic subject record is the unit of write
- no field-level merge is attempted

### `practice_sessions`

Mutation style:

- whole-record upsert keyed by session id
- explicit learner or subject clear routes for destructive operations

Conflict rule:

- learner-scoped compare-and-swap
- no attempt to merge overlapping session changes

Interrupted request rule:

- if the server committed an active session write but the client lost the response, retrying the same `requestId` replays the stored response instead of duplicating the mutation

### `child_game_state`

Mutation style:

- whole state object replace per `(learnerId, systemId)`
- or explicit clear

Conflict rule:

- learner-scoped compare-and-swap
- no deep merge of reward / game payloads

### `event_log`

Mutation style:

- append-only from the API point of view
- learner-scoped revision still applies

Conflict rule:

- learner-scoped compare-and-swap
- duplicate append retries rely on request-receipt replay instead of re-appending

### Resets, imports, and destructive actions

Current rule set:

- learner list replacement / learner removal / selected learner changes are **account-scoped** mutations
- learner-scoped clears (`subject state`, `practice sessions`, `game state`, `event log`) are **learner-scoped** mutations
- import currently behaves like ordinary repository writes from the browser side
- the backend does **not** have a special import merge mode

That means destructive actions still obey the same explicit revision rules instead of bypassing the safety layer.

## Client retry and resync policy

The API repository adapter uses three behaviors.

### Retryable transport failure

Examples:

- network error
- timeout
- Worker / backend `5xx`

Behavior:

- local cache keeps the optimistic change
- the pending operation remains queued
- persistence mode becomes `degraded`
- trusted state becomes `local-cache`
- manual `Retry sync` attempts the queued writes again in order

### Interrupted request after server commit

Behavior:

- the client may think the write failed
- the pending operation stays queued
- the next retry sends the same `requestId`
- the Worker replays the stored response instead of applying the mutation again

### Stale write conflict

Behavior:

- the failed operation is marked `blocked-stale`
- later pending operations in the same scope are also blocked
- persistence mode becomes `degraded`
- retry / resync first reloads the latest remote state
- blocked local operations are discarded during that retry path
- the user must repeat the blocked local change intentionally if they still want it

There is no hidden merge and no silent conflict resolution.

## Reload behavior

On hydrate, the API adapter:

1. reads the latest remote bootstrap bundle
2. reads remote `syncState`
3. reapplies still-pending local operations onto the cached bundle
4. replays local sync state from those still-pending operations only

If a write had already been committed remotely but the client did not know yet, the replayed server response corrects the local revision line on retry so the client does not stay one revision ahead.

## Logging and diagnostics

### Client-side (`[ks2-sync]`)

Current logs include:

- queued operation id / kind / scope
- expected revision
- pending write count
- applied revision
- replayed flag
- blocked / failed conflict details
- discarded blocked-op counts during retry

### Worker-side (`[ks2-worker]`)

Current logs include:

- `mutation.applied`
- `mutation.replayed`
- mutation kind / scope / request id / correlation id
- expected revision
- applied revision

This is enough to trace one mutation across browser retry logic and backend commit/replay behavior.

## Durable Object note

This pass does **not** add a Durable Object coordination layer.

That is deliberate.
The current mutation model is single-request compare-and-swap plus idempotency receipts.
That is enough for the current minimum backend without pretending we have real-time coordination or long-running server-side workflows.

If later work truly requires stronger coordination, the limit should stay narrow:

- learner-scoped serialization only
- only for workflows that cannot be expressed safely as one compare-and-swap mutation

## Known unresolved edges

- no automatic merge for concurrent edits
- no push invalidation or real-time fan-out to other tabs/devices
- no background retry scheduler or backoff worker
- blocked stale writes are discarded on retry; the user must redo them intentionally
- learner-scoped revisioning is conservative, so unrelated learner collections can still conflict with each other
- request-receipt retention / pruning is not designed yet
- Durable Object coordination is still deferred until a real need appears
