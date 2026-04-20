# Repository contract boundary

## Why this exists

The important deployment boundary is not browser versus Worker.

It is local repository versus remote repository.

The platform shell, the shared store, the Spelling service, and the reward layer all talk to one repository-shaped interface.
That keeps the browser reference build inspectable now while making the future backend boundary explicit instead of implied.

## Platform repository contract

A platform repository bundle exposes one persistence-status section, five data sections, and three lifecycle methods.

The persisted collections are versioned through repository metadata so adapters can normalise malformed payloads before the rest of the app sees them.

```txt
hydrate()
flush()
clearAll()

persistence
learners
subjectStates
practiceSessions
gameState
eventLog
```

## Persistence status

The shell does not infer persistence health from transport errors anymore.
It reads an explicit persistence snapshot from the repository adapter.

```txt
read()
subscribe(listener)
retry()
```

Current modes:

- `local-only`
  - No remote backend is active for this adapter.
  - The trusted durable copy is this browser's storage.
- `remote-sync`
  - Remote sync is available and there are no pending unsynced writes.
  - The trusted durable copy is remote.
- `degraded`
  - A remote write failed, a remote bootstrap failed and the adapter fell back to cache, or browser storage itself failed.
  - The shell must treat the state as bounded fallback state, not as confirmed remote durability.

The snapshot also carries:

- `trustedState`
  - `local`, `remote`, `local-cache`, or `memory`
- `cacheState`
  - `local-only`, `aligned`, `ahead-of-remote`, `stale-copy`, or `memory-only`
- `pendingWriteCount`
- `inFlightWriteCount`
- `lastSyncAt`
- `lastError`

That lets the shell say something truthful about what state is currently safe to trust.

## Learners

Stores the shared learner snapshot used by the shell.

```txt
read()
write(snapshot)
```

The snapshot shape stays platform-wide:

```txt
byId
allIds
selectedId
```

## Child subject state

Stores one generic record per learner and subject.

```txt
read(learnerId, subjectId)
readForLearner(learnerId)
writeUi(learnerId, subjectId, ui)
writeData(learnerId, subjectId, data)
writeRecord(learnerId, subjectId, record)
clear(learnerId, subjectId)
clearLearner(learnerId)
```

The record shape is generic.

```txt
ui
data
updatedAt
```

That keeps the transport and persistence shape generic even though each subject still owns its own `data` payload.

For Spelling today:

- `ui` holds the serialisable subject UI state used for resume and routing
- `data.prefs` holds spelling preferences
- `data.progress` holds the preserved legacy progress map

## Practice sessions

Stores resumable or recent subject sessions separately from subject UI state.

```txt
latest(learnerId, subjectId)
list(learnerId, subjectId?)
write(record)
clear(learnerId, subjectId)
clearLearner(learnerId)
```

The current Spelling reference implementation writes active, completed, and abandoned session records here.

## Reward / game state

Stores reward-layer state separately from learning engines.

```txt
read(learnerId, systemId)
readForLearner(learnerId)
write(learnerId, systemId, state)
clear(learnerId, systemId)
clearLearner(learnerId)
```

The monster codex currently uses `systemId = "monster-codex"`.

## Event log

Optional append-only event storage.

```txt
append(event)
list(learnerId?)
clearLearner(learnerId)
```

The current reference wiring appends both spelling mastery events and reward events.

## Save and sync semantics

### Local adapter

`createLocalPlatformRepositories()` stores the generic collections in localStorage and migrates legacy PoC keys into the new generic repository shape on first load.

Write semantics are explicit:

- mutations update the in-memory bundle first
- the adapter then tries to persist the full bundle locally
- if local persistence succeeds, mode stays `local-only`
- if local persistence fails, mode becomes `degraded`
- in that degraded local case, the current browser memory is the only trusted state until persistence recovers
- `flush()` and `persistence.retry()` throw while the local write problem still exists

The local adapter does not silently swallow storage failure anymore.

### API adapter

`createApiPlatformRepositories()` exposes the same repository contract after `hydrate()`.

Write semantics are explicit:

- the mutation is applied to the local cache immediately so the live session can continue
- a semantic pending operation is recorded in the cache
- each write carries a `requestId`, `correlationId`, and expected account or learner revision
- the Worker uses database compare-and-swap plus request receipts
- if the remote write succeeds, the pending operation is cleared
- if the remote write had actually already committed and the client is only retrying, the stored response is replayed and the pending operation still clears safely
- if the remote write fails transiently, the pending operation stays queued and the adapter enters `degraded`
- if the remote write is stale, the failed operation and later same-scope operations become blocked until retry / resync reloads the latest remote state
- while degraded after a remote failure, the trusted state is the local cache, not the server
- `flush()` and `persistence.retry()` throw until the pending operations are actually cleared

That means the shell no longer has to pretend a remote write succeeded just because the local cache updated.

### Reload and restore behavior

On bootstrap, the API adapter reads the remote bundle and then reapplies any locally cached pending operations.

That keeps unsynced local changes visible after reload instead of letting a stale remote bootstrap wipe them out.
When that happens, the cache is explicitly `ahead-of-remote` until a later retry clears the pending writes.

If the remote bootstrap fails but a local cache exists, the adapter continues from that cache in `degraded` mode.

## What is intentionally still deferred

- production auth rollout beyond the development/test session stub
- billing, invites, and messaging
- automatic merge for concurrent edits
- offline retry scheduling beyond manual retry / flush behaviour
- push-based real-time invalidation across tabs / devices
- read-only viewer UX in the browser shell
- Durable Object coordination beyond the current compare-and-swap backend

The Worker now has D1-backed persistence, account-scoped ownership, repository-level authorisation for learner-scoped writes, atomic revision checks, and request-receipt replay. The remaining items are the next SaaS-hardening layer, not this pass.


## Mutation safety layer

The API-backed path now has an explicit mutation policy.

- account-scoped writes use `adult_accounts.repo_revision`
- learner-scoped writes use `learner_profiles.state_revision`
- every write route requires a `requestId`
- repeated retries with the same payload replay the stored response instead of applying twice
- stale writes return `409 stale_write`
- the client does not auto-merge or hide stale conflicts
- retry / resync reloads the latest remote state and discards blocked stale local writes

The detailed policy lives in `docs/mutation-policy.md`.

## Spelling content repository boundary

Spelling content is now handled through a separate content repository/service pair rather than being embedded long-term in runtime code modules.

This boundary is intentionally separate from the learner progress repositories above.

- learner repositories store learner-owned state, sessions, game state, and events
- spelling content repositories store account-scoped operator content bundles with draft rows, immutable published releases, and a publication pointer

Current content repository implementations:

- `createLocalSpellingContentRepository()`
- `createApiSpellingContentRepository()`

Current content service:

- `createSpellingContentService()`

Important rule:

- the spelling runtime reads `getRuntimeSnapshot()` from the content service
- that runtime snapshot resolves from the published release only
- live draft edits do not flow straight into learner sessions

This keeps content-management rules outside the spelling engine while still letting the shell rebuild the spelling service against a published snapshot when content changes are published.

## Portable import and export

The rebuild supports portable JSON snapshots above the repository boundary.

- full app export/import uses `ks2-platform-data`
- learner-scoped export/import uses `ks2-platform-learner`
- legacy snapshots shaped like `{ learners, subjectUi }` are still accepted and normalised into generic subject-state records

That keeps import/export logic aligned with the same generic repository shapes used by local and API-backed adapters.
