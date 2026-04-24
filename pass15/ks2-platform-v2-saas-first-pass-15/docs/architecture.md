# Target architecture

## Design goal

Make the platform easy to extend sideways.

Adding a new KS2 subject should feel like adding a subject module, not like reopening the spelling engine, the dashboard shell, the monster system, the database schema and the deployment pipeline all at once.

## Core layers

### 1. Platform shell

Owns:

- app routing
- learner selection
- shared layout
- shared tabs
- toasts and notifications
- dashboard subject registry

Does not own:

- subject learning logic
- subject marking rules
- subject-specific progress scheduling

The shell now does own one explicit safety concern: subject-local runtime containment. If a subject render or action path throws, the shell converts that failure into a bounded fallback surface for the active subject tab instead of letting the whole screen or route collapse.

### 2. Subject module

Every subject implements the same contract.

```txt
id
name
blurb
initState()
getDashboardStats()
renderPractice()
renderAnalytics()
renderProfiles()
renderSettings()
renderMethod()
handleAction()
```

This is the main change that turns the product from “Spelling plus placeholders” into an actual platform.

The registry should validate this contract at startup. Fail early on missing methods or duplicate ids rather than discovering boundary drift at render time.

Subject presentation metadata such as accent colours belongs on the subject module. Services stay deterministic and presentation-free.

### 3. Subject engine / service

Every real subject gets its own deterministic service.

For Spelling, that service wraps the preserved legacy engine. In the hardened reference slice, the service also owns the serialisable subject state contract, session restoration, and domain-event emission. Reward persistence happens in a separate adapter after the service emits a secure-word event.

For future subjects, the service should own:

- content retrieval
- session creation
- answer submission
- progress updates
- summary generation
- subject analytics snapshots

The shell only calls the service. It does not inspect the engine internals.

### 4. Reward layer

The game layer is reactive.

It consumes published domain events through a platform event runtime rather than being called from subject modules directly.
Current subscribers include the spelling-to-monster reward adapter and a derived practice-streak subscriber.
The persisted reward state is reaction history for toasts and milestones. Visible monster/Codex mastery is projected from the current spelling progress state so it stays aligned with imported, synced or repaired secure words.
Inklet and Glimmerbug evolve at 10, 30, 60 and 90 secure words in their own spelling pools. Phaeton evolves from the combined secure-word total at 25, 95, 145 and 200.

Current domain events include:

- `spelling.retry-cleared`
- `spelling.word-secured`
- `spelling.mastery-milestone`
- `spelling.session-completed`
- `platform.practice-streak-hit`

The reward layer should not decide how a learner is quizzed, marked or scheduled.

That keeps the product vision honest: game and learning compound each other without replacing each other.

### 5. Deployment boundary

The browser version uses local persistence and deterministic services for speed and clarity.

The Cloudflare version should swap in API-backed repositories without changing subject renderers.

That means the real boundary is not “browser versus Worker”.
It is “local repository versus remote repository”.

### 6. Operating read models

Adult-facing surfaces read from durable platform state after the subject services have done their work.

Parent Hub and Admin / Operations now sit in this layer.
They consume learners, subject state, practice sessions, events, account-scoped spelling content and mutation receipts through explicit read-model builders.
They do not own spelling pedagogy, content publication rules, or mutation safety.

That keeps the SaaS operating surfaces useful without turning the subject engines into reporting systems.

## Data model

## Browser state

```txt
route
learners
subjectUi
toasts
```

Browser state is for interaction, not canonical mastery history.

## Durable platform data

Recommended server-side tables:

### `users`
Adult account holders.

### `learners`
Child profiles owned by users.

### `child_subject_state`
Generic per-subject state.

Suggested columns:

```txt
learner_id
subject_id
state_json
updated_at
PRIMARY KEY (learner_id, subject_id)
```

The important detail is that `state_json` should stay generic.
A useful envelope is:

```txt
ui
data
updatedAt
```

That lets the platform store resumable subject UI state without owning subject internals, while each subject still owns its own `data` payload.

This replaces subject-specific columns such as `spelling_progress_json` and scales naturally to all six subjects.

### `practice_sessions`
Live or recent sessions.

Suggested columns:

```txt
id
learner_id
subject_id
session_kind
session_state_json
summary_json
created_at
updated_at
```

### `child_game_state`
Reward-layer storage, separate from subject engines.

Suggested columns:

```txt
learner_id
system_id
state_json
updated_at
PRIMARY KEY (learner_id, system_id)
```

### `event_log` or `reward_events`
Optional append-only audit trail for important mastery and reward events.


## State integrity rules

The rebuild now treats state integrity as an architectural concern, not as scattered defensive code.

- repository adapters normalise generic persisted collections before the shell consumes them
- subjects normalise their own local `data` payloads inside the generic subject-state envelope
- malformed persisted values shrink to safe defaults instead of leaking mixed shapes upward
- portable import/export runs through the same repository contracts rather than bypassing them

That keeps migration logic close to the actual boundary that can change: persisted platform data and subject-owned payloads.

## Repo shape

```txt
src/platform
  access
  core
  game
  hubs
  ui
src/subjects
  spelling
  arithmetic
  reasoning
  grammar
  punctuation
  reading
worker
  src
  migrations
docs
tests
```

This layout keeps the subject engines discoverable and stops platform concerns from leaking into each subject folder.

## Why Spelling is preserved, not rewritten

The spelling engine already contains the valuable part:

- scheduling logic
- stage progression
- retry flow
- summary behaviour
- word-family handling
- deterministic marking

Rewriting that from scratch would be expensive and unnecessary.

The correct move is to wrap it behind a clean service and remove the architectural debt around it.

## Why the reference rebuild is dependency-light

A heavy framework stack would hide the design point.

This rebuild keeps the reference implementation transparent so the next team can inspect the actual boundaries.

If you later decide to put the shell back onto React, Vue or another framework, the key win is that the subject contract and repository boundary will already exist.

## Repository bundle

The implemented reference boundary is now a repository bundle with five sections, and the event log is where subject-domain events, derived platform events and reward reactions all meet:

```txt
learners
subjectStates
practiceSessions
gameState
eventLog
```

Both the local adapter and the API adapter expose the same cache-backed shape.
That means the shell and subject modules do not care whether the backing store is local or remote once the repository has hydrated.
