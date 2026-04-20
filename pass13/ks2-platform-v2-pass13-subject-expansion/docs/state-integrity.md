# State integrity and upgrade behaviour

This pass hardens the rebuild around one rule:

state must either normalise into an explicit contract or fail safely into a smaller, known-good shape.

## State boundary audit

### In-memory app state

The store owns only interaction state:

```txt
route
learners
subjectUi
toasts
```

Hardening added in this pass:

- route values are normalised to known screens and tabs
- subject UI is rebuilt through each subject's `initState()` contract
- persisted subject UI must be an object or it is dropped
- toast entries are filtered to objects and capped

That keeps the shell from carrying malformed persisted values forward implicitly.

### Browser persistence

The repository layer is now the canonical browser boundary.

Hardening added in this pass:

- repository collections are normalised as collections, not just record-by-record
- repository metadata is versioned with `REPO_SCHEMA_VERSION`
- malformed local storage payloads are repaired on hydrate and written back in normalised form
- legacy local keys are still migrated into the generic repository shape

### Import / export JSON

Portable JSON snapshots now use explicit export kinds:

```txt
ks2-platform-data
ks2-platform-learner
```

Hardening added in this pass:

- full-app imports replace the current dataset deterministically
- learner imports merge into the current dataset without clobbering an existing learner id
- old rebuild-era app snapshots shaped like `{ learners, subjectUi }` are still accepted and normalised into generic subject-state records
- malformed imports fail with a clear error instead of partially mutating the app

### Session state

Practice sessions are stored separately from subject UI state.

Hardening added in this pass:

- practice-session records are normalised before write
- malformed or partial session payloads are reduced to safe record shapes
- spelling can restore partial serialised session state without assuming the full original object graph survived persistence

### Subject state

Subject persistence remains generic:

```txt
ui
data
updatedAt
```

Hardening added in this pass:

- collection keys are validated as learner/subject pairs
- `ui` must be an object or `null`
- `data` must be an object or `{}`
- spelling now explicitly normalises its own `data` payload as `{ prefs, progress }`

### Reward state

Reward state is still separate from pedagogy and is now also normalised at the repository boundary.

Hardening added in this pass:

- invalid reward-state collections are reduced to plain objects only
- game-state export/import runs through the same learner-scoped repository contract as subject state

## Normalisation and migration strategy

There are two layers on purpose.

### 1. Repository-level normalisation

Repository adapters normalise and repair the generic platform collections.
This covers:

- learners
- child subject state
- practice sessions
- child game state
- event log
- repository metadata

This is where versioned repository upgrades belong.

### 2. Subject-level normalisation

Each subject still owns its own `data` contract inside the generic envelope.
For the Spelling reference slice, that means:

```txt
subject state record
  ui -> serialisable spelling service state used by the shell
  data.prefs -> spelling preferences
  data.progress -> preserved legacy progress map
```

This keeps platform migrations generic and subject migrations local.

## Recovery rules

These are the deliberate fail-safe rules now enforced by the rebuild.

- Bad top-level learner snapshots fall back to an empty normalised learner map.
- Bad route values fall back to the dashboard route.
- Bad subject UI values fall back to each subject's `initState()` result.
- Bad repository collections become empty normalised collections, not implicit mixed shapes.
- Bad import payloads throw before any partial import work is committed.
- Conflicting learner imports are copied to a new learner id instead of overwriting existing data.
- Partial spelling session state restores only the fields that still satisfy the service contract.

## Upgrade notes for future contributors

- Increment `REPO_SCHEMA_VERSION` only when the persisted repository collections change shape.
- Keep repository migrations generic. Do not smuggle spelling-specific fields into the platform collections.
- Keep subject-specific migration rules inside the subject adapter or service contract normalisers.
- Add a round-trip test whenever you change exported JSON or a persisted record shape.
- Prefer replacing malformed state with a smaller valid shape over trying to preserve every broken field.
