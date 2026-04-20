# Foundation readiness for subject expansion

This document reruns the “foundation-ready-for-expansion” gate after Pass 12 and the Pass 13 subject-expansion harness work.

It is intentionally explicit.
It does **not** make broad readiness claims for production SaaS launch.
It answers the narrower question:

**Is the repo now ready for the first controlled non-Spelling subject thin slice?**

## Decision

**Result: GO for the first Arithmetic thin slice.**

This is a go-ahead for a narrow second real subject.
It is **not** a claim that the product is fully launch-ready as a finished multi-tenant SaaS.

## Gate criteria and status

| Criterion | Status | Why it passes or fails now |
| --- | --- | --- |
| Subject runtime containment | PASS | Pass 6 made render/action containment real, and Pass 13 now reruns containment through a reusable conformance suite against both Spelling and a candidate subject fixture. |
| Golden-path smoke coverage | PASS | Pass 6 added golden-path smoke for Spelling and placeholder navigation. Pass 13 adds a reusable smoke harness that now runs against Spelling and a non-Spelling candidate subject. |
| Subject module contract | PASS | Pass 1 already enforced the registry/module contract at startup. Pass 13 now makes that contract part of the reusable expansion fixture path. |
| Deterministic thin-slice service contract | PASS | Spelling already provides the real reference service from Pass 2. Pass 13 now defines and tests the thin-slice service-method set required for the first new real subject. |
| Generic repository wiring | PASS | Pass 3 created the real repository boundary. Passes 7–9 hardened persistence honesty, backend persistence, and mutation rules. Pass 13 proves a non-Spelling candidate subject can persist state and sessions through the same generic collections. |
| Event publication boundary | PASS | Pass 4 decoupled the reward layer from pedagogy. Pass 13 proves a candidate subject can publish domain events through the existing runtime without special new side stores. |
| Analytics snapshot path | PASS | Spelling already exposed subject analytics, and Pass 12 proved adult-facing read models on durable data. Pass 13 now requires a subject-owned analytics snapshot in the conformance path. |
| Shared-tab rendering without shell redesign | PASS | Spelling and the candidate fixture both render Practice, Analytics, Profiles, Settings, and Method through the same shell tabs. |
| Spelling remains the reference subject | PASS | Existing parity, content, backend, and hub tests still stand. Pass 13 also reruns the new conformance + smoke harness directly against Spelling. |
| Production auth / full SaaS launch readiness | FAIL (not part of this gate) | Production auth rollout, richer multi-subject operations, billing, and broader launch work remain outside this gate. This does not block the first Arithmetic thin slice. |

## What changed since the earlier fail state

The original expansion gate failed because two things were still too weak:

1. subject render/action failures were not fully contained
2. golden-path smoke coverage was too narrow

That fail state is no longer true.

Pass 6 closed the runtime-containment and smoke gaps.
Passes 7–9 closed the persistence-honesty, Worker-backend, and mutation-safety gaps that would have made a second subject operationally fragile.
Pass 10 locked preserved Spelling behaviour down.
Pass 11 moved Spelling content out of long-term code blobs.
Pass 12 added real adult-facing read models and explicit role lines on durable data.
Pass 13 now adds the reusable subject-expansion harness and reruns the gate against both the real reference subject and a candidate second-subject fixture.

## What is now true

- a future subject can be judged by a repeatable conformance suite instead of informal code review only
- a future subject can be judged by a repeatable smoke harness instead of Spelling-only happy-path assumptions
- repository wiring, session persistence, event publication, analytics exposure, and containment are now part of the required acceptance path
- English Spelling remains the reference implementation and still passes that path
- the repo no longer needs to “drift into” subject two by momentum alone

## What is still deliberately not claimed

The following are still not being claimed as complete:

- production auth rollout
- broad multi-subject launch readiness
- a finished editorial back office for every subject
- richer parent/admin reporting for non-Spelling subjects
- full organisation / invite / billing / messaging workflows

Those are real future concerns.
They are just not the blocking gate for the first Arithmetic thin slice.

## Exact go / no-go output

### Go

Go ahead with the first Arithmetic thin slice **only** if it stays inside the scope defined in `docs/subject-expansion.md`.

### No-go

Do **not** use this gate result to justify:

- adding more than one new real subject at once
- bundling reasoning, fractions, geometry, and content-CMS work into the same pass
- claiming full SaaS production readiness
- weakening the requirement that Spelling must remain green as the reference subject

## Minimum acceptance for the Arithmetic pass

Arithmetic should only be considered complete when all of the following are true:

- it plugs into the new conformance suite
- it plugs into the new golden-path smoke harness
- it persists through the generic repository collections
- it publishes domain events through the existing event runtime
- it exposes a subject-owned analytics snapshot
- it does not widen shell special-casing beyond explicit subject-service wiring
- Spelling still passes unchanged as the reference subject
