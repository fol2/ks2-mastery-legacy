# Phased reconstruction plan

## Phase 0 — Stabilise understanding

Goal: know exactly what is being preserved.

Deliverables:

- audit the live product flow
- isolate reusable spelling logic
- identify UI traits worth preserving
- separate true strengths from accidental complexity

Exit condition:

- the team agrees what is a keeper, what is legacy baggage, and what is genuinely product-defining

## Phase 1 — Build the platform skeleton

Goal: create a neutral shell that does not belong to Spelling.

Deliverables:

- shared app shell
- subject registry
- learner model
- shared dashboard cards
- tabbed subject layout
- shared toasts and reward surfaces

Exit condition:

- placeholder subjects can exist without touching Spelling code

## Phase 2 — Wrap the legacy spelling engine

Goal: preserve the learning value while removing the old integration debt.

Deliverables:

- spelling service wrapper
- subject module for Spelling
- local repository implementation
- deterministic session flow inside the new shell
- preserved word data and sentence banks

Exit condition:

- English Spelling is fully usable in the rebuilt shell

## Phase 3 — Separate the game layer properly

Goal: make reward logic reactive rather than controlling.

Deliverables:

- monster system storage
- event-based reward hooks
- codex progress surfaces in dashboard and summary
- clean placeholders for quests, cosmetics and progression later

Exit condition:

- learning events can update the game layer without the game layer deciding pedagogy

## Phase 4 — Define the Cloudflare boundary

Goal: stop deployment concerns from leaking into subject code.

Deliverables:

- worker route skeleton
- generic schema proposal
- subject state storage contract
- learner lock pattern for mutation-heavy subjects

Exit condition:

- the browser version and Worker version can share subject modules and service interfaces

## Phase 5 — Hardening

Goal: make future work safer.

Deliverables:

- unit tests for subject services
- store tests for learner management
- subject runtime containment for render/action handling
- smoke checks for route and action handling
- migration docs for the next team

Exit condition:

- core spelling behaviour is guarded by tests and the extension rules are documented

## Phase 6 — Subject expansion

Recommended order:

1. Arithmetic
   - smallest engine surface
   - highest value for rapid breadth
2. Reasoning
   - strongest product leverage for KS2 SATs
3. Grammar
4. Punctuation
5. Reading

The first new subject after Spelling should prove that the contract is real. Arithmetic is the best candidate for that.

## Delivery principle

Each phase should leave the app shippable.

That matters because the main failure mode of the original PoC was not lack of code. It was compounding fragility. A rebuild only helps if each stage decreases fragility instead of moving it around.
