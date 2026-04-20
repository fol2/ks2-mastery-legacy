# KS2 Platform v2 — Pass 13 report

## Scope

This pass is **only** about making “add subject two” a controlled engineering act.

It follows the already-established guarantees from:

- Pass 6 — subject runtime containment + golden-path smoke coverage
- Pass 7 — persistence honesty and degraded-state surfacing
- Pass 8 — D1-backed Worker backend + learner ownership model
- Pass 9 — mutation safety, revisions, idempotency, and stale-write handling
- Pass 10 — English Spelling parity hardening and regression protection
- Pass 11 — versioned spelling content model
- Pass 12 — Parent Hub / Admin operating surfaces

Those earlier passes remain the source of truth.
This pass does **not** add Arithmetic itself.
It does **not** widen product scope.
It does **not** claim full production SaaS readiness.

## Goal

Build the reusable expansion acceptance path for the first non-Spelling subject:

- reusable subject conformance fixtures
- reusable golden-path smoke harness
- explicit “add a subject” checklist
- explicit rerun of the readiness gate
- explicit go / no-go output
- exact recommended scope for the future Arithmetic thin slice

## Outcome

Result: **pass completed**

The repo now has a real expansion harness.

What is now true:

- a future real subject can be judged by a repeatable conformance suite instead of informal review only
- a future real subject can be judged by a repeatable smoke harness instead of Spelling-only assumptions
- the required thin-slice service contract is now explicit
- repository wiring, event publication, analytics exposure, runtime containment, and smoke coverage are now all part of the subject-entry gate
- English Spelling still passes as the reference subject
- the foundation-ready-for-expansion gate now reruns as an explicit **GO** for the first Arithmetic thin slice

What is **not** being claimed:

- that the repo is now generally production-launch-ready as a full SaaS
- that production auth rollout is complete
- that more than one new real subject should be added at once

## What was built

## Reusable subject conformance fixture suite

Added:

- `tests/helpers/subject-expansion-harness.js`

This now provides reusable suites for a candidate subject module.
The conformance path checks that a subject:

- satisfies the enforced module contract
- exposes the thin-slice service method set
- renders all shared subject tabs
- persists UI and subject data through generic platform repositories
- writes active/completed practice-session records through the standard collection
- publishes domain events through the standard event runtime
- stays contained when render/action paths fail

## Reusable golden-path smoke harness

Also added in:

- `tests/helpers/subject-expansion-harness.js`

The smoke harness now checks that a candidate subject can:

- open from the shared dashboard
- enter a live round
- finish to a summary
- return cleanly to its subject dashboard
- preserve a live round through learner switching
- preserve a live round through import/export restore

## Candidate subject fixture

Added:

- `tests/helpers/expansion-fixture-subject.js`

This is a **non-production** candidate subject fixture.
It exists only to prove the platform can absorb a second deterministic thin slice without shell redesign.

What it deliberately demonstrates:

- subject module contract compliance
- deterministic subject service
- generic `child_subject_state` wiring
- generic `practice_sessions` wiring
- event publication through the standard runtime
- subject-owned analytics snapshot
- no hidden side stores

It is not a shipped product subject.
It is not Arithmetic.
It is a proof fixture for the expansion gate.

## Reference-subject confirmation

Added:

- `tests/subject-expansion.test.js`

This runs both reusable suites against:

- English Spelling — the reference subject
- the non-production candidate fixture

That matters because the expansion harness is not floating in the abstract.
It is anchored to the real preserved reference subject and also proven against a non-Spelling second-subject stand-in.

## App-harness seam for future subject tests

Updated:

- `tests/helpers/app-harness.js`

The test harness can now accept extra non-Spelling services.
That keeps future subject expansion testing narrow and avoids ad hoc per-test shell rewrites.

## Docs added

Added:

- `docs/subject-expansion.md`
- `docs/expansion-readiness.md`
- `pass-13.md`

Updated:

- `README.md`

## Add-a-subject checklist now documented

The new checklist explicitly covers:

- module contract
- deterministic service contract
- repository wiring
- event publication
- analytics snapshot
- runtime containment
- smoke coverage
- scope discipline

That checklist is now the standard pre-merge gate for the first real non-Spelling subject.

## Readiness gate rerun

## Criterion-by-criterion result

| Criterion | Status | Why |
| --- | --- | --- |
| Subject runtime containment | PASS | Pass 6 made containment real, and Pass 13 reruns it through the reusable conformance suite. |
| Golden-path smoke coverage | PASS | Pass 6 added baseline smoke coverage; Pass 13 adds reusable subject smoke coverage against Spelling and a candidate fixture. |
| Module contract | PASS | Already enforced since Pass 1; now part of the reusable subject-entry path. |
| Deterministic thin-slice service contract | PASS | Spelling already provided the reference service; Pass 13 now defines and tests the expected thin-slice service-method set. |
| Generic repository wiring | PASS | Passes 3 / 7 / 8 / 9 already made the persistence and backend boundaries honest; Pass 13 proves a non-Spelling candidate subject can use those same boundaries. |
| Event publication boundary | PASS | Pass 4 already decoupled pedagogy from rewards; Pass 13 proves candidate subject domain events can flow through the existing runtime. |
| Analytics snapshot path | PASS | Spelling already had subject analytics; Pass 13 now requires a subject-owned analytics snapshot in the conformance path. |
| Shared-tab rendering without shell redesign | PASS | Spelling and the candidate fixture both render Practice / Analytics / Profiles / Settings / Method through the same shell. |
| Spelling remains the reference subject | PASS | Existing Spelling parity/content/backend tests remain green, and the new expansion suites also run directly against Spelling. |
| Production SaaS launch readiness | FAIL (not part of this gate) | Production auth rollout and broader launch work are still outside scope and still not being claimed complete. |

## Explicit go / no-go decision

### Decision

**GO** for the first Arithmetic thin slice.

That go decision is narrow and specific.
It means the repo is now ready to absorb one carefully-scoped second real subject.

It does **not** mean:

- add multiple new real subjects at once
- bundle broader reasoning/fractions/measure/geometry expansion into the same pass
- claim full production-launch readiness

## Exact recommended scope for the future Arithmetic pass

The recommended Arithmetic pass should build only:

- one real `arithmetic` subject module
- one deterministic arithmetic service
- one arithmetic repository adapter against the generic platform collections
- one arithmetic analytics snapshot
- one arithmetic conformance spec + smoke spec using the new Pass 13 harness

Recommended learning scope for the first Arithmetic slice:

- addition facts
- subtraction facts
- multiplication facts up to 12 × 12
- related division facts
- simple inverse missing-number items tied directly to those fact families

Keep the first Arithmetic pass narrow:

- numeric-answer only
- Smart Review + Trouble Drill only
- no SATs reasoning mode yet
- no fractions / decimals / percentages yet
- no measure / geometry / statistics yet
- no content CMS work
- no adult-surface expansion bundled into the subject pass
- no TTS/AI work unless the arithmetic slice genuinely requires it

## Why this pass is enough

This pass does not add subject two.
That is deliberate.

What it does is more important first:

- it turns subject expansion into a repeatable acceptance path
- it keeps Spelling as the reference subject instead of a special-case accident
- it gives a future Arithmetic pass a precise bounded scope
- it keeps the repo from drifting into multi-subject growth without a gate

That is the right move before adding the first real non-Spelling subject.

## Files added / updated

Added:

- `tests/helpers/subject-expansion-harness.js`
- `tests/helpers/expansion-fixture-subject.js`
- `tests/subject-expansion.test.js`
- `docs/subject-expansion.md`
- `docs/expansion-readiness.md`
- `pass-13.md`

Updated:

- `tests/helpers/app-harness.js`
- `README.md`

## Test result

Current suite result:

**89 / 89 tests passing**
