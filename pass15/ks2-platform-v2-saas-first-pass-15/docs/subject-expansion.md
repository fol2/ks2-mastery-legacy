# Subject expansion harness and checklist

This repo now treats “add a second real subject” as a bounded engineering change, not as a loose product drift.

This document defines the reusable acceptance path for a first non-Spelling subject.
It sits on top of the earlier platform guarantees from:

- Pass 6 — subject runtime containment + golden-path smoke coverage
- Pass 7 — persistence honesty and degraded-state surfacing
- Pass 8 — D1-backed Worker backend + learner ownership
- Pass 9 — mutation safety, idempotency, and stale-write handling
- Pass 10 — Spelling parity hardening
- Pass 11 — spelling content model
- Pass 12 — Parent Hub / Admin operating surfaces

## What was added in Pass 13

Reusable test assets now live in:

- `tests/helpers/subject-expansion-harness.js`
  - reusable conformance suite registration
  - reusable golden-path smoke-suite registration
  - shared thin-slice service-method list
- `tests/helpers/expansion-fixture-subject.js`
  - a non-production candidate subject fixture
  - deterministic service
  - generic repository wiring
  - domain-event publication through the standard runtime
- `tests/subject-expansion.test.js`
  - runs the conformance suite and smoke suite against:
    - English Spelling as the reference subject
    - the candidate fixture subject as a stand-in for a future second real subject

The fixture subject is **not** a shipped product subject.
It exists only to prove the platform can carry a second deterministic thin slice without shell redesign.

## Thin-slice reference contract

The platform already enforces the subject module contract at startup.
Pass 13 now adds a stricter **reference thin-slice contract** for the first real non-Spelling subject.

### Module contract

The subject module must still satisfy the existing enforced registry contract:

- `id`
- `name`
- `blurb`
- `initState()`
- `getDashboardStats()`
- `renderPractice()`
- `renderAnalytics()`
- `renderProfiles()`
- `renderSettings()`
- `renderMethod()`
- `handleAction()`

### Thin-slice service contract

For the first real subject after Spelling, use the same explicit service shape that the new harness expects:

- `initState(previousState, learnerId)`
- `getPrefs(learnerId)`
- `savePrefs(learnerId, patch)`
- `getStats(learnerId)`
- `getAnalyticsSnapshot(learnerId)`
- `startSession(learnerId, options)`
- `submitAnswer(learnerId, uiState, response)`
- `continueSession(learnerId, uiState)`
- `endSession(learnerId, uiState)`
- `resetLearner(learnerId)`

Transition-returning methods must stay explicit and serialisable:

```txt
{ ok, changed, state, events, audio }
```

That is not a giant universal subject abstraction.
It is the intentionally narrow contract for the first expansion slice.

## Repository and event rules for a new subject

A new subject must reuse the existing durable generic platform boundaries.

### Repository wiring

Allowed storage paths:

- `child_subject_state`
  - subject UI snapshot
  - subject-owned data snapshot such as prefs/progress
- `practice_sessions`
  - active / completed / abandoned subject rounds
- `event_log`
  - published domain events and any derived downstream reactions

Do not introduce:

- hidden extra browser stores as the source of truth
- subject-specific side databases
- analytics-only shadow stores
- direct subject writes to adult-facing dashboard state

### Event publication

The subject service should publish domain events in transitions.
The platform event runtime remains responsible for downstream reactions.

Do not push reward mutation back into the subject engine.

### Analytics snapshot

A candidate subject must expose a subject-owned analytics snapshot that can power:

- dashboard summary
- subject analytics tab
- future Parent/Admin reporting

That snapshot should come from the subject’s own durable state plus platform session/event data, not hidden UI state.

## Add-a-subject checklist

Use this checklist before merging a new real subject.

### 1. Module contract

- subject id is unique
- startup registry validation passes
- all five shared subject tabs render
- no shell route or tab was added just for this subject

### 2. Deterministic service contract

- subject has an explicit service with the thin-slice methods above
- service state is serialisable and restore-safe
- session selection / generation is deterministic under fixed inputs
- transitions return `{ ok, changed, state, events, audio }`
- no pedagogy or scheduling is hidden inside the shell renderer

### 3. Repository wiring

- learner UI state persists through `child_subject_state.ui`
- subject prefs/progress persist through `child_subject_state.data`
- active/completed rounds persist through `practice_sessions`
- no hidden client-only state is required to resume a round
- import/export restore keeps the live round intact

### 4. Event publication

- service publishes explicit domain events
- event runtime can append them without subject-specific route changes
- downstream reward/reporting logic stays separate from pedagogy

### 5. Analytics snapshot

- dashboard stats come from subject state, not hard-coded shell values
- analytics tab renders from a real subject snapshot
- broad strengths / weaknesses can be derived later without rewriting the engine

### 6. Runtime containment

- broken render paths fall back inside the active subject tab
- broken handleAction paths fall back inside the active subject tab
- learner selection, routing, toasts, and other subjects survive the failure

### 7. Smoke coverage

- dashboard → subject → start → answer → summary → back passes
- learner switch preserves a live round
- import/export restore preserves a live round
- all tests pass without widening shell special-cases

### 8. Scope discipline

- no new adult-facing hub or billing work bundled in
- no production-auth rollout hidden inside the subject pass
- no content-management system unless the subject genuinely needs one
- Spelling still passes as the reference subject after the change

## What the reusable suites now prove

### Conformance suite

The new conformance suite proves that a subject:

- satisfies the module contract
- exposes the thin-slice service contract
- renders all shared tabs
- persists state and practice-session records through generic repositories
- publishes at least one real domain event through the event runtime
- stays contained if render or action paths explode

### Golden-path smoke suite

The new smoke suite proves that a subject can:

- start from the shared dashboard
- enter a live round
- finish to a summary
- return safely to its dashboard
- survive learner switching
- survive import/export restore while live

## Spelling remains the reference subject

The new suites run against English Spelling itself, not only against the candidate fixture.
That means the first expansion harness is anchored to the real preserved reference subject.

Spelling remains the standard for:

- subject/service separation
- deterministic transition handling
- repository wiring
- event publication
- session recovery
- smoke coverage expectations

## Go-ahead brief for the future Arithmetic pass

The foundation is now strong enough for the **first Arithmetic thin slice**, but only within a narrow scope.

### Recommended scope

Build only:

- one real `arithmetic` subject module
- one deterministic arithmetic service
- one generic repository adapter layer using the existing platform collections
- one analytics snapshot for arithmetic progress
- one golden-path smoke spec + one conformance spec using this harness

### Recommended learning slice

Keep the first Arithmetic pass to **fluency**, not reasoning.

Include only:

- addition facts
- subtraction facts
- multiplication facts up to 12 × 12
- related division facts
- simple inverse missing-number variants tied directly to those fact families

Keep answers to a single numeric response.

### Recommended modes

Include only:

- Smart Review
- Trouble Drill

Leave out for the first Arithmetic pass:

- broader SATs reasoning flows
- fractions / decimals / percentages
- measure / money / geometry
- multi-step contextual word problems
- handwriting / OCR / free-form working capture
- content CMS work
- TTS work unless arithmetic genuinely needs it

### Required architecture shape

Arithmetic should mirror the same thin-slice seam used by the new fixture:

```txt
subject module → deterministic service → generic repositories → event runtime → analytics snapshot
```

### Required acceptance for merge

Arithmetic should not merge until:

- its own spec is plugged into `tests/helpers/subject-expansion-harness.js`
- its own golden-path smoke spec passes
- its own conformance suite passes
- the full repo stays green
- Spelling still passes as the reference subject
