# KS2 Platform v2 — Pass 14 report

## Scope

This pass closes the signed-in adult-access honesty gap on the SaaS-first branch.

It does not widen the product into invites, billing, provider-account linking, organisations, a new subject, or Arithmetic delivery. English Spelling remains the only live subject. The goal here was narrower: make signed-in Parent Hub and Admin / Operations reflect real Worker platform-role and learner-membership data, including readable viewer memberships, without pretending those learners are writable shell contexts.

## Current truth before the pass

Before this pass, the backend already had the real ingredients: production auth/session, D1-backed generic repositories, degraded-sync honesty, mutation receipts, stale-write rebase, role-aware Worker hub endpoints, admin-only platform-role management, and Worker-side TTS proxy. Parent Hub and Admin / Operations also already existed.

The signed-in shell was the dishonest layer.

### Short access-assumption audit

- `src/main.js` still assembled signed-in hub models locally instead of treating Worker hub payloads as source of truth.
- `src/platform/hubs/api.js` already existed but was unused by the shell.
- Signed-in hub model assembly still hard-coded `membershipRole: 'owner'` and synthesised owner memberships from writable learners.
- The shell collapsed platform role and learner membership role into one practical assumption.
- `/api/bootstrap` still surfaced writable learners only, so readable viewer memberships were invisible in shell state.
- Adult surfaces reused writable-learner shell state instead of keeping separate adult-surface learner context.
- Viewer learners could therefore be shown with misleading write affordances.
- A deeper issue also existed: when signed-in bootstrap came back with zero writable learners, the store path could auto-seed a default learner. In a viewer-only account, that would have fabricated a learner and fake owner-style shell access.

## Why this pass was chosen

This was the smallest SaaS-first move that materially improved product honesty without widening scope.

The Worker already knew the truth about account role, readable memberships, writable memberships, and viewer access. The signed-in shell did not. That meant Parent Hub and Admin / Operations looked more complete than they really were, and viewer contexts could be misrepresented as writable. Fixing that gap improves trust, keeps the product shippable, and strengthens the current SaaS operating surfaces without dragging the branch into subject-two expansion.

## What was implemented

Signed-in Parent Hub and Admin / Operations now load real Worker hub payloads through the existing hub API seam instead of relying on locally assembled synthetic hub models.

Code changes:

- `src/main.js`
  - wired signed-in Parent Hub and Admin / Operations to `createHubApi()`
  - added remote parent/admin hub loading state, error state, and adult-surface notice state
  - added separate adult-surface learner selection state so readable learners do not pollute writable bootstrap state
  - blocked read-only viewer write actions with explicit bounded messaging instead of hidden failure or silent no-op
  - removed signed-in synthetic hub membership assumptions as shell source of truth
- `src/platform/hubs/shell-access.js` (new)
  - centralises role/membership/writability interpretation for remote hub payloads
  - centralises read-only action blocking reasons
- `src/platform/ui/render.js`
  - shows platform-role and membership-role labels from remote payloads
  - adds adult-surface learner selection for readable learners
  - shows explicit writable vs read-only learner labels
  - prevents read-only viewer contexts from displaying as if they are normal writable shell learners
  - disables fake write affordances on Parent Hub and Admin / Operations when the selected adult learner is read-only
  - adds honest zero-writable signed-in shell states instead of pretending a learner exists
- `src/platform/hubs/parent-read-model.js`
  - now carries accessible learner entries, selected learner id, membership labels, and writable/read-only access labels
- `src/platform/hubs/admin-read-model.js`
  - now carries readable learner diagnostics with explicit membership-role and writable/read-only labels
  - parent-hub entry point is now conditional on real readable membership context instead of synthetic owner assumptions
- `worker/src/repository.js`
  - Parent Hub now resolves readable memberships, not just writable bootstrap state
  - Parent Hub now returns accessible readable learners, including viewers, plus selected learner context
- `src/platform/core/store.js`
  - remote or signed-in empty bootstrap no longer auto-creates a default learner
  - local-reference mode keeps the old local convenience behaviour
- docs updated for honesty in `README.md`, `docs/operating-surfaces.md`, `docs/ownership-access.md`, and `docs/repositories.md`

### Before / after: signed-in shell role and membership honesty

Before:

- signed-in Parent Hub and Admin / Operations were rendered from locally assembled shell models
- signed-in shell diagnostics assumed synthetic owner memberships from writable learners
- platform role and learner membership role were not honestly separated in those surfaces
- viewer memberships were absent from shell UX even when the Worker knew about them
- a viewer-only signed-in account could fall into fake learner creation because of empty-bootstrap auto-seeding

After:

- signed-in Parent Hub and Admin / Operations read live Worker hub payloads
- platform role and learner membership role are surfaced separately in UI labels
- readable viewer learners are selectable in adult surfaces
- writable bootstrap state remains separate from adult-surface readable learner state
- read-only viewer contexts are clearly labelled and their write paths are explicitly blocked in shell UX
- signed-in zero-writable bootstrap stays honest instead of inventing a learner

## User-visible changes

Signed-in Parent Hub now shows the real adult-surface learner from the Worker payload, along with platform role, membership role, and writable/read-only access status.

Signed-in Admin / Operations now shows readable learner diagnostics from the Worker payload, including viewer memberships, with the same explicit access labelling.

Viewer learners can now be selected in adult surfaces when returned by the hub routes.

When the currently selected adult learner is read-only, the UI now says so plainly and disables write affordances such as current-learner export, full-app export from that context, subject entry from adult surfaces, and learner/profile/reset/import paths that would mutate writable learner state.

If a signed-in account has no writable bootstrap learner in the main shell, the shell now says that honestly instead of quietly fabricating one.

## Admin / operator / support changes

Operations now reflects readable learner access honestly, including viewer memberships, instead of implying writable diagnostics access.

Support and operator tooling now get explicit learner access labels in admin diagnostics: membership role, writable boolean, and readable vs writable copy.

Admin-only platform-role management remains unchanged functionally, but the surrounding Admin / Operations surface is now more honest about which learner contexts are actually writable.

## Backend / data / architecture changes

No new backend domain model was introduced.

The boundary change is that signed-in adult surfaces now consume the existing Worker hub contract through the existing hub API seam, rather than re-deriving adult access locally from writable bootstrap learner state.

`/api/bootstrap` remains writable-only by design in this pass.

Readable learner state for adult surfaces is now handled as separate hub context instead of being merged into the main writable learner repository snapshot.

Worker Parent Hub now returns readable accessible learners, including viewer memberships, so the shell can render honest adult-surface selection without widening the generic repository bootstrap contract.

The store’s remote empty-bootstrap behaviour was corrected so signed-in viewer-only accounts do not get a fabricated learner.

## Tests added or updated

Added:

- `tests/hub-api.test.js`
  - covers hub API client usage for Parent Hub and Admin Hub routes
- `tests/hub-shell-access.test.js`
  - covers remote hub access-context derivation and read-only action blocking reasons

Updated with new coverage:

- `tests/render.test.js`
  - signed-in Parent Hub render/state from real remote payloads
  - signed-in Admin / Operations render/state from real remote payloads
  - read-only viewer render and blocked write affordances
  - writable member no-regression flow from remote payloads
- `tests/worker-hubs.test.js`
  - Parent Hub returns readable viewer learners with explicit read-only labels
  - Admin Hub returns viewer diagnostics without inventing writable access
- `tests/worker-access.test.js`
  - writable bootstrap remains writable-only while viewer learners remain readable through hub routes

Updated for no-regression after the empty-bootstrap honesty fix:

- `tests/repositories.test.js`
- `tests/worker-backend.test.js`

New test count added in this pass: 11.

## Test results

Targeted adult-access / hub / render suite passed:

- `node --test tests/hub-api.test.js tests/hub-shell-access.test.js tests/worker-hubs.test.js tests/worker-access.test.js tests/render.test.js`
- 22 tests passed

Remote-harness regression suite passed after the remote empty-bootstrap guard:

- `node --test tests/repositories.test.js tests/worker-backend.test.js`
- 7 tests passed

Full suite passed:

- `npm test --silent`
- 136 tests passed, 0 failed

## Known limitations

`/api/bootstrap` still returns writable learners only. Viewer learners do not enter the main subject shell bootstrap.

Viewer learners are selectable only inside Parent Hub and Admin / Operations. They are not promoted into writable subject runtime, learner profile editing, or import/reset flows.

Adult-surface learner selection is a hub-surface concern in this pass. It is not yet a persisted backend-selected learner preference across reloads for all adult surfaces.

Local-reference mode is preserved and still assembles local inspection surfaces without the signed-in Worker round-trip. The new honesty claim is about the signed-in Worker path.

The signed-in shell is more honest now, but that does not make the wider platform launch-ready.

## What is still not being claimed

- no new subject is live
- no Arithmetic thin slice is delivered here
- no invite or sharing workflow
- no billing
- no organisation model
- no provider-account linking beyond what already existed
- no viewer participation inside the writable subject shell
- no new reporting warehouse or full parent reporting suite
- no launch-readiness claim for the wider SaaS product

## Bugs / risks / observations noticed but not fixed

The most important extra issue noticed during this pass was the remote empty-bootstrap auto-seed path. That is fixed now, but it shows the shell still has some historical bias toward “there is always a writable learner”. Future signed-in onboarding should treat zero-writable accounts as a first-class state, not as an exceptional edge case.

Adult-surface learner selection currently lives in shell state, not a persisted backend preference. Reloads can therefore fall back to the account-selected readable learner or first readable learner returned by the Worker.

Because the main shell is still writable-only, there is still some surface duplication between “adult learner selected in a hub” and “writable learner selected in the shell”. That duplication is now honest, but it is still present.

## Recommended next prompt

Pass 15 on the SaaS-first branch: add honest signed-in onboarding and empty states for zero-writable accounts, including an explicit create-learner flow for parent/member accounts and clean viewer-only routing to Parent Hub / Admin without subject-shell leakage; keep English Spelling as the only live subject and do not add invites, billing, or a new subject.
