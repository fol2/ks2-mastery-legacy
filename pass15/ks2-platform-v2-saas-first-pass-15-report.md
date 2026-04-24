# KS2 Platform v2 — Pass 15 report

## Scope

This pass makes signed-in zero-writable accounts first-class and honest on the SaaS-first branch.

It does not add a new subject, invites, sharing workflow build-out, provider-account linking, billing, an organisation model, or any widening of the writable shell. English Spelling remains the only live subject. `/api/bootstrap` stays writable-only. Viewer learners remain hub-only.

## Current truth before the pass

Before this pass, Pass 14 had already fixed the signed-in adult-surface honesty gap for Parent Hub and Admin / Operations by using live Worker hub payloads, separating platform role from learner membership role, surfacing readable viewer memberships in adult surfaces, and explicitly blocking fake write actions in read-only adult contexts.

The remaining gap was signed-in zero-writable routing and onboarding.

What was still true before this pass:

- `/api/bootstrap` intentionally returned writable learners only.
- A signed-in account with zero writable learners still fell back to a thin generic dashboard / "No writable learner" shell state instead of a first-class signed-in route.
- A brand-new signed-in parent with no learners had no explicit create-first-learner path.
- Viewer-only and other zero-writable accounts could manually reach adult surfaces, but the shell still had dashboard / subject-shell bias and leakage risk.
- `learner-create` was still a writable-shell concept, not an honest signed-in onboarding path.
- `open-subject` could still look like a broken learner-selection route instead of an honest zero-writable reroute.
- Reload / hydrate was more honest than before because empty bootstrap no longer fabricated a learner, but it still was not a first-class signed-in home flow.

### Short zero-writable signed-in path audit

Audited paths and the pre-pass problem that remained in each one:

- **Initial signed-in boot after `/api/bootstrap`**
  - Empty writable bootstrap stayed truthful, but only as a thin fallback state.
  - The shell still treated the dashboard as the implicit home even when no writable learner existed.
- **Reload / hydrate**
  - Fresh reloads stayed empty instead of fabricating a learner, but there was still no explicit signed-in home route for zero-writable accounts.
- **`navigate-home`**
  - Home navigation still biased back toward the dashboard shell instead of routing by real account capability.
- **`open-subject`**
  - Subject entry could still feel like a broken shell path when no writable learner existed.
- **`open-parent-hub`**
  - Viewer-only parents could reach Parent Hub manually, but the shell did not treat it as the default honest destination.
- **`open-admin-hub`**
  - Admin / ops zero-writable accounts could reach Operations manually, but that was not the default signed-in home route.
- **`learner-create` / `learner-select`**
  - `learner-create` still belonged to the writable learner manager, so a brand-new signed-in parent had no explicit onboarding flow.
  - `learner-select` remained a writable-shell action only, which was correct, but the surrounding shell copy still implied a broken selection bug rather than an intentional zero-writable state.

## Why this pass was chosen

This was the smallest SaaS-first move that turned signed-in zero-writable accounts from an edge-case fallback into an honest product state without widening scope.

Pass 14 had already made adult surfaces truthful. The next honest move was to stop routing zero-writable signed-in accounts through dashboard / subject-shell assumptions and to add the missing first learner creation path for brand-new parent accounts.

That improves trust, reduces shell leakage, and keeps the main subject shell writable-only.

## What was implemented

### New explicit signed-in zero-writable route and shell state

A dedicated signed-in zero-writable state now exists instead of relying on the generic dashboard fallback.

Code changes:

- `src/platform/access/zero-writable-shell.js` **(new)**
  - centralises writable-shell detection for learner snapshots
  - resolves honest zero-writable default destinations from platform role plus Parent Hub readable payloads
  - centralises explicit reroute copy for blocked subject entry
- `src/platform/core/store.js`
  - adds `zero-writable` as a first-class route
  - adds `openZeroWritable()` store routing helper
- `src/platform/ui/render.js`
  - renders a dedicated zero-writable signed-in screen
  - adds a minimal create-first-learner onboarding card
  - removes fake subject-launch / learner-management affordances from the zero-writable screen
  - keeps the visual direction intact while making the state explicit

### Honest signed-in routing for zero-writable accounts

`src/main.js` now routes signed-in zero-writable accounts by actual account capability instead of sending them through the writable dashboard path.

Implemented routing rules:

- parent + readable learner memberships -> **Parent Hub**
- admin / ops + zero writable learners -> **Admin / Operations**
- brand-new parent with no readable learner context -> **create-first-learner onboarding**
- zero-writable accounts do **not** enter the writable subject shell as if a learner exists

### Explicit create-first-learner onboarding for brand-new parents

A signed-in parent with no readable or writable learner now gets a minimal onboarding form instead of a broken-looking empty dashboard.

The form is intentionally narrow:

- learner name
- year group

On submit it creates a real learner through the existing learners repository route:

- reads the current signed-in account revision from `/api/session`
- writes the shared learner snapshot to `/api/learners` with the required account CAS revision
- lets `writeLearnersSnapshot()` persist `adult_accounts.selected_learner_id`
- rehydrates the shell from the repository boundary
- lands the account back in the normal writable home state with the new learner selected

No fake learner is synthesised locally.

### Cleaner handling of the audited paths

- **Initial signed-in boot after `/api/bootstrap`**
  - empty writable bootstrap now opens `zero-writable` first, then resolves to Parent Hub, Admin / Operations, or create-first-learner onboarding
- **Reload / hydrate**
  - fresh signed-in hydrates remain empty when they should be empty and reroute through the same explicit zero-writable path resolution
- **`navigate-home`**
  - now delegates to account-capability routing instead of blindly treating dashboard as home
- **`open-subject`**
  - remains blocked / rerouted honestly when no writable learner exists, with explicit copy instead of a misleading shell failure
- **`open-parent-hub`**
  - zero-writable parent accounts now resolve to Parent Hub or onboarding honestly
- **`open-admin-hub`**
  - zero-writable admin / ops accounts now resolve to Admin / Operations honestly
- **`learner-create` / `learner-select`**
  - signed-in zero-writable `learner-create` now reroutes to the dedicated first-learner onboarding instead of pretending writable learner management already exists
  - writable `learner-select` continues to work unchanged
  - readable viewer learner selection remains adult-surface only and does not widen the main writable shell

### Remaining shell-bias cleanup in this pass

- no fake learner management on the zero-writable screen
- no subject-launch affordances on the zero-writable screen
- no misleading dashboard copy that looks like a broken learner-selection bug
- bounded next-step guidance based on the account’s real access path
- render-loop guard added so zero-writable signed-in resolution does not keep re-requesting hub routes while an adult hub load is already in flight

### Docs updated for truthful signed-in onboarding

Updated:

- `README.md`
- `docs/operating-surfaces.md`
- `docs/ownership-access.md`

These now describe the explicit signed-in zero-writable routing story and the narrow first-learner onboarding flow truthfully.

### Before / after status

#### Zero-writable onboarding

**Before**

- signed-in brand-new parent accounts had no explicit create-first-learner path
- the shell fell back to a thin generic no-writable dashboard state
- learner creation still looked like writable-shell management instead of onboarding

**After**

- signed-in brand-new parent accounts get a dedicated create-first-learner onboarding screen
- the form creates a real learner through the existing learners write boundary
- success lands the account in a real writable bootstrap state with that learner selected

#### Viewer-only routing honesty

**Before**

- viewer-only parents could manually reach Parent Hub, but the shell still had dashboard / subject-shell bias
- zero-writable admin / ops accounts could manually reach Operations, but that was not the default signed-in home

**After**

- viewer-only signed-in parents resolve to Parent Hub as the honest default surface
- zero-writable admin / ops accounts resolve to Admin / Operations as the honest default surface
- neither account type is routed through the main writable subject shell as if a writable learner exists

## User-visible changes

Signed-in accounts with zero writable learners now get an explicit signed-in state instead of a broken-looking dashboard fallback.

A brand-new signed-in parent with no learners now sees a minimal "Create your first learner" onboarding form.

Viewer-only signed-in parents now land in Parent Hub by default.

Admin / ops signed-in accounts with no writable learners now land in Admin / Operations by default.

When a signed-in zero-writable account tries to open a subject route, the shell now explains honestly that no writable learner exists in the main shell and routes the user back to the correct adult surface or onboarding path.

## Admin / operator / support changes

Support now has a clearer story for three common signed-in states that previously looked similar from the shell:

- brand-new parent with no learners
- viewer-only parent with readable learners
- admin / ops account with no writable learners

Operations remains functionally the same, but zero-writable admin / ops accounts now reach it as their default signed-in home surface instead of passing through a misleading writable-shell fallback.

Parent Hub remains hub-only for readable viewer contexts, but viewer-only parents now reach it through honest default routing instead of manual workaround navigation.

## Backend / data / architecture changes

No new backend domain model or table was introduced.

Important architecture changes in this pass:

- `/api/bootstrap` remains writable-only by design
- the shell now has an explicit `zero-writable` route rather than treating empty writable bootstrap as a dashboard variant
- first-learner onboarding uses the existing `/api/learners` repository route and the shared learner snapshot model
- first-learner onboarding reads the current account revision from `/api/session` so the Worker CAS write stays valid
- `adult_accounts.selected_learner_id` remains the persisted default learner seam; no broader preference model was added
- local reference mode is preserved

## Tests added or updated

Added:

- `tests/zero-writable-shell.test.js` **(new)**
  - brand-new parent resolves to create-first-learner onboarding
  - viewer-only parent resolves to Parent Hub
  - admin / ops zero-writable resolves to Admin / Operations
  - subject reroute copy stays explicit
  - writable learner detection stays honest

Updated:

- `tests/store.test.js`
  - store can route to the explicit `zero-writable` screen
- `tests/render.test.js`
  - signed-in zero-writable parent render shows explicit first-learner onboarding
  - zero-writable render does not leak writable learner creation or subject-launch affordances
- `tests/worker-access.test.js`
  - brand-new signed-in parent hydrate stays honest while no writable learner exists
  - create-first-learner success produces a real writable bootstrap state, owner membership, and persisted selected learner

New tests added in this pass: **9**.

## Test results

Targeted zero-writable suite passed:

```bash
node --test tests/render.test.js tests/worker-access.test.js tests/zero-writable-shell.test.js tests/store.test.js
```

- **24 tests passed**

Full suite passed:

```bash
npm test --silent
```

- **145 tests passed, 0 failed**

Pass 14 ended at 136 tests passing. This pass ends at 145 passing.

## Known limitations

`/api/bootstrap` still returns writable learners only.

Viewer learners still remain hub-only. They do not enter the main writable subject shell, learner profile editing flow, or learner-write flows.

The create-first-learner onboarding is intentionally narrow. It creates the first learner, but it is not a broader account setup wizard.

Adult-surface readable learner selection is still not persisted as a broader preference model across all adult surfaces. The pass continues to prefer the existing `adult_accounts.selected_learner_id` seam only for the writable learner bootstrap.

The zero-writable signed-in screen is now explicit, but it is still a thin product surface rather than a full onboarding system.

Local reference mode still works, but the new onboarding / routing honesty claim is about the signed-in Worker path.

## What is still not being claimed

- no new subject is live
- no Arithmetic thin slice is delivered here
- no invite or sharing workflow build-out
- no billing
- no organisation model
- no provider-account linking beyond what already existed
- no viewer participation inside the writable subject shell
- no broader multi-step parent onboarding journey
- no launch-readiness claim for the wider SaaS product

## Bugs / risks / observations noticed but not fixed

The first-learner path now uses the current Worker session’s account revision immediately before the learners write. That keeps the CAS mutation correct, but it still means a concurrent account-scope write from another tab can make the onboarding write go stale and require a retry.

Readable adult-surface learner selection is still a shell concern, not a fully persisted readable-context preference across reloads and adult surfaces.

The signed-in zero-writable route is now explicit, but there is still some shell duplication between adult-surface readable learner context and writable learner context because the main shell remains intentionally writable-only.

The onboarding form is deliberately minimal and does not yet include duplicate-name handling, richer profile setup, or guided explanation beyond the narrow next step.

## Recommended next prompt

Pass 16 on the SaaS-first branch: persist honest signed-in adult-surface landing and readable learner selection using the existing `adult_accounts.selected_learner_id` seam where valid, reduce remaining dashboard/header leakage for zero-writable accounts, and keep `/api/bootstrap` writable-only with English Spelling as the only live subject.
