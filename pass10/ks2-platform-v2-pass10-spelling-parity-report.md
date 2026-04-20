# KS2 Platform v2 — Pass 10 report

## Scope

This pass is **only** about English Spelling parity hardening and regression protection.

It follows the already-established platform guarantees from:

- Pass 6 — subject runtime containment + golden-path smoke coverage
- Pass 7 — persistence honesty and degraded-state surfacing
- Pass 8 — real D1-backed Worker backend + learner ownership model
- Pass 9 — mutation safety, revisions, idempotency, and stale-write handling

Those platform passes remain the source of truth.
This pass does **not** widen scope into a second subject, a framework rewrite, or a pedagogy redesign.

## Goal

Make the rebuilt English Spelling slice match the intended behaviour and feel of the older single-page spelling version more closely, while keeping the rebuilt architecture boundaries intact.

## Baseline used

Direct comparison baseline for this pass:

- `legacy/ks2_english_spelling/ks2_spelling_sprint_refactor_core.html`
- `legacy/ks2_english_spelling/README_ks2_spelling_refactor_core.txt`
- `legacy/spelling-engine.source.js`

Because the legacy single-page source was attached, this pass makes direct parity claims only where that baseline could be inspected.

## Outcome

Result: **pass completed**

The rebuilt English Spelling slice now better matches the preserved legacy behaviour in the places that materially affected the learning feel:

- live recall no longer leaks family cues
- retry / correction UI wording is back in line with the legacy flow
- marked cards auto-advance again with preserved legacy timing intent
- explicit confirm-before-abandon and confirm-before-switch are back
- the practical legacy shortcut loop is restored inside active Spelling practice
- new regression tests now lock those behaviours down

The preserved spelling engine itself was not reinterpreted.
No backend, repository, or multi-subject architecture boundaries were re-entangled.

## Parity matrix

| Area | Legacy baseline | Pass 9 state | Pass 10 action | Status after Pass 10 |
| --- | --- | --- | --- | --- |
| Session creation | Smart Review, Trouble Drill, SATs 20, year filter, round size, trouble fallback to Smart, immediate mode-start shortcuts | Core engine/session creation already matched through preserved engine and prefs wiring | Restored quick-start keyboard entry points and audio-stop-on-start guard | Matched for engine flow; quick-start interaction now mostly matched |
| Retry / correction flow | Wrong first attempt -> blind retry; wrong retry -> correction with answer shown; corrected word returns once later; no answer leakage on first miss | Engine flow already matched, but live UI labels felt flatter than legacy | Restored phase-specific submit labels/placeholders and legacy-feel auto-advance timing | Matched |
| Secure-word progression | New word needs two clean hits in one round; secure threshold remains stage >= 4; due-day scheduling stays legacy | Already matched by preserved engine | No engine change | Matched |
| Summary output | Learning/test summaries preserve legacy cards, wording, mistake drill, and follow-up drills | Already matched through engine finalise + summary UI | No logic change | Matched |
| Analytics | Aggregate secure/due/trouble/fresh/accuracy stats and year-band splits were present; legacy also exposed searchable word-bank progress and direct bank drill | Aggregate analytics matched, but searchable word bank was not rebuilt | Documented remaining delta only | Partial |
| Preferences | Mode, year filter, session size, auto-play, cloze toggle, audio provider/model/key/rate controls | Core spelling prefs matched except richer audio/provider controls | No provider-rate rebuild in this pass | Partial |
| Resume / abandon / continue | Legacy confirmed before discarding/switching, auto-advanced after marked cards, and did not preserve platform-level resume across learner switches | Manual Continue button and no end-session confirm were real mismatches; platform resume was intentionally broader | Restored end/switch confirmation and auto-advance; kept platform-level resume as an intentional delta | Partial, with key regressions fixed |
| TTS / audio behaviour | Auto-play, replay, slow replay, audio reset on switch/home/profile change, browser/API provider options, warm-up behaviour | Browser dictation loop existed; provider-specific options and warm-up were not rebuilt | Restored shortcut replay flow and ensured new rounds stop prior audio before starting | Partial |
| Keyboard / interaction flow | Enter submit, Esc replay, Shift+Esc slow replay, Alt+1/2/3 start modes, Alt+S skip, Alt+K focus, ignore Alt shortcuts while typing in unrelated inputs | Most subject shortcuts were missing | Restored Esc / Shift+Esc / Alt+1/2/3 / Alt+S / Alt+K with guarded typing behaviour | Mostly matched inside active Spelling practice |
| Live-card hint leakage | Legacy explicitly hid the family during live recall and only surfaced family words after the engine allowed it | Pass 9 leaked family/family-count chips during the live card | Removed live family leakage and restored the hidden-family note | Matched |

## Genuine gaps/regressions found

### Fixed in this pass

1. **Live family leakage**
   - The rebuilt live card exposed `Family: ...` and family-count chips.
   - The legacy card explicitly hid the family during live recall.
   - This was a genuine pedagogy-affecting regression because it leaked an extra cue.

2. **Manual continue instead of legacy auto-advance feel**
   - The preserved engine still returned the right state transitions, but the rebuilt UI forced an extra Continue click after marked cards.
   - The older single-page version auto-advanced after a short delay.
   - This is now restored without moving progression logic back into the UI.

3. **Missing confirm before abandoning a live session**
   - The older single-page version confirmed before ending a round or switching mode mid-session.
   - The rebuilt slice ended a session immediately.
   - The confirm guard is now restored.

4. **Shortcut regression**
   - The older single-page version preserved a practical keyboard loop.
   - The rebuilt slice had lost most of it.
   - This is now restored inside active Spelling practice.

5. **Phase-specific interaction text drift**
   - Legacy submit labels and placeholders changed with retry/correction/test flow.
   - The rebuilt slice had flattened those distinctions.
   - The clearer legacy wording is back.

## Code changes

Added:

- `src/subjects/spelling/session-ui.js`
  - subject-owned UI parity helpers for submit labels, placeholders, context notes, and footer text
- `src/subjects/spelling/auto-advance.js`
  - shell-safe auto-advance controller with preserved legacy timing intent
- `src/subjects/spelling/shortcuts.js`
  - guarded shortcut resolver for Spelling-only keyboard interactions
- `tests/helpers/manual-scheduler.js`
  - deterministic timer helper for auto-advance regression coverage
- `tests/spelling-parity.test.js`
  - direct parity/regression tests for restored legacy behaviours
- `docs/spelling-parity.md`
  - full parity matrix, explicit remaining deltas, and unverified areas
- `pass-10.md`
  - concise in-repo pass note

Updated:

- `src/subjects/spelling/module.js`
  - hides family cues during live recall
  - restores phase-specific submit labels/placeholders
  - adds confirm-before-end and confirm-before-shortcut-switch
  - stops prior audio when starting/restarting/drilling a round
- `src/main.js`
  - wires Spelling shortcut handling and auto-advance scheduling without coupling those rules into the service or repository layers
- `tests/helpers/app-harness.js`
  - shares the same shortcut and auto-advance seams used by the runtime
- `docs/spelling-service.md`
  - updated preserved-legacy notes + Pass 10 parity notes
- `README.md`
  - docs list now includes the direct spelling parity audit

## Tests added / updated

Added coverage now proves:

- live cards do not leak family cues
- retry / correction / test submit wording follows the preserved legacy flow
- SATs cards remain audio-first with the restored save-and-next wording
- end-session abandonment is confirmed before clearing a live round
- shortcut quick-start still confirms before switching away from a live round
- shortcut resolution matches Esc / Shift+Esc / Alt+1/2/3 / Alt+S / Alt+K and ignores unrelated typing targets
- auto-advance timing stays locked for learning vs SATs saves
- one-word learning rounds can progress through the restored auto-advance path without a manual Continue click

## Test result

Current suite result:

**66 / 66 tests passing**

## Updated spelling docs

Added / updated:

- `docs/spelling-parity.md`
- `docs/spelling-service.md`
- `pass-10.md`

## Remaining deltas

These remain after this pass and are documented explicitly rather than treated as silent parity claims.

1. The searchable word-bank progress / direct bank-drill UI from the old single-page app is still not rebuilt.
2. Provider/API TTS controls, voice/model selection, rate slider, and warm-up behaviour are still not restored.
3. Platform-level resume across learner switch/navigation/reload remains broader than legacy by design.
4. Shortcut scope is intentionally limited to active Spelling practice instead of the whole multi-subject shell.

## Still cannot be directly verified

1. Exact browser playback timing and warm-up behaviour for the legacy provider-backed TTS paths.
2. Provider-specific Gemini/OpenAI/ElevenLabs request handling from the old single-page file.
3. Exact visual timing/animation feel beyond what could be inferred from the code and locked through deterministic tests.

## Why this pass is enough for now

This closes the most meaningful parity gaps without dragging the repo back toward the old single-file fragility.

The preserved engine still owns scheduling, marking, progression, and summary generation.
The shell now better respects the older interaction contract, but the architecture remains service-boundary / repository-boundary / event-boundary based.
