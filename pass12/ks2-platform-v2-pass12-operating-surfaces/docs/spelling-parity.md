# English Spelling parity audit — Pass 10

## Baseline used

Direct comparison baseline for this pass:

- `legacy/ks2_english_spelling/ks2_spelling_sprint_refactor_core.html`
- `legacy/ks2_english_spelling/README_ks2_spelling_refactor_core.txt`
- `legacy/spelling-engine.source.js`

This pass therefore makes direct parity claims only where the legacy single-page source was available to inspect.
Provider-specific browser/API TTS traffic and exact browser playback timing were not directly replayed end-to-end in this pass; those points are called out separately below.

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

## Genuine gaps/regressions found from the direct baseline

### Fixed in this pass

1. **Live family leakage**
   - The rebuilt live card exposed `Family: ...` and family-count chips.
   - The legacy card explicitly hid the family during live recall.
   - This was a real pedagogy-affecting regression because it provided an extra cue.

2. **Manual continue instead of legacy auto-advance feel**
   - The preserved engine still returned the correct feedback states, but the rebuilt UI forced an extra Continue click after marked cards.
   - The older single-page version auto-advanced after a short delay.
   - Pass 10 restores that behaviour without moving progression logic back into the UI.

3. **Missing confirm before abandoning a live session**
   - The older single-page version confirmed before ending a round or switching mode mid-session.
   - The rebuilt slice ended a session immediately.
   - Pass 10 restores the confirmation guard.

4. **Shortcut regression**
   - The older single-page version preserved a practical keyboard loop.
   - The rebuilt slice had lost most of it.
   - Pass 10 restores the preserved shortcut set that still makes sense inside the platform shell.

5. **Phase-specific interaction text drift**
   - Legacy submit labels and placeholders changed with the retry/correction flow.
   - The rebuilt slice kept a flatter generic submit label.
   - Pass 10 restores the clearer legacy wording.

## Intentionally different after this pass

These deltas remain on purpose.

1. **Platform-level session resume remains broader than legacy**
   - The rebuilt platform still preserves serialisable spelling sessions across learner switches, navigation, reload, and import/export restore.
   - The older single-page app generally confirmed and discarded when switching context.
   - This broader resume behaviour stays because it is a platform hardening win and does not change the spelling pedagogy itself.

2. **Keyboard shortcuts are scoped to the active Spelling practice surface**
   - The older single-page app could treat shortcuts as app-global because the whole app was Spelling.
   - The rebuilt platform now contains multiple subject surfaces.
   - Pass 10 therefore scopes restored shortcuts to active Spelling practice to avoid cross-subject collisions.

3. **Provider/API TTS controls are still not restored**
   - The older single-page app exposed browser/API provider choice, keys, model/voice controls, backup Gemini key handling, and warm-up behaviour.
   - The rebuilt platform still uses the simpler browser speech path.

4. **Searchable word-bank drill UI is still not restored**
   - Legacy exposed searchable word-bank progress and direct single-word drill launch from that bank.
   - The rebuilt slice still exposes mistake drills and summary follow-ups, but not the full bank UI.

## Still not directly verified in this pass

1. Exact browser playback timing and warm-up behaviour for old provider-backed TTS paths.
2. Provider-specific Gemini/OpenAI/ElevenLabs request handling from the old single-page file.
3. Exact visual timing/animation feel beyond what could be inferred from the code and reconstructed through deterministic tests.

## Regression tests added in this pass

- hidden-family live card regression coverage
- retry/correction submit-label and placeholder coverage
- SATs audio-only card wording coverage
- confirm-before-end-session coverage
- confirm-before-shortcut-mode-switch coverage
- shortcut-resolution coverage for Esc / Shift+Esc / Alt+1/2/3 / Alt+S / Alt+K
- auto-advance delay and one-word-round continuation coverage
