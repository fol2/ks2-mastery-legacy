# English Spelling service contract

This is the reference subject-service implementation for the rebuilt KS2 platform.

## Public contract

`createSpellingService()` now exposes an explicit stateful contract:

- `initState(rawState, learnerId)`
  - Normalises and restores persisted spelling subject state.
  - Returns a safe dashboard state if the saved session is stale or malformed.
- `getPrefs(learnerId)` / `savePrefs(learnerId, patch)`
  - Subject-local preferences only.
- `getStats(learnerId, yearFilter)`
  - Normalised dashboard stats for one pool.
- `getAnalyticsSnapshot(learnerId)`
  - Explicit analytics payload with `all`, `y34`, and `y56` pools.
- `startSession(learnerId, options)`
  - Creates a fresh deterministic session state.
- `submitAnswer(learnerId, state, typed)`
  - Resolves one submission against the active card.
  - Ignores duplicate submissions once the card is already awaiting advance.
- `continueSession(learnerId, state)`
  - Advances after a saved result, or finalises to a summary.
- `skipWord(learnerId, state)`
  - Applies the preserved “skip for now” behavior.
- `endSession(state)`
  - Returns the dashboard state without mutating progress.
- `stageLabel(stage)`
  - Preserved display label helper.
- `resetLearner(learnerId)`
  - Clears spelling progress and spelling preferences for one learner.

The service also accepts an injected `contentSnapshot`.
When omitted it uses the bundled spelling word data.
When provided it consumes only the published spelling-content runtime snapshot.

Every state transition returns the same shape:

```txt
{
  ok,
  changed,
  state,
  events,
  audio
}
```

`events` are domain events from the spelling service. The service does not mutate the reward layer directly.

## Persisted subject-state invariants

The spelling subject state is JSON-serialisable and versioned.

```txt
{
  version,
  phase,
  session,
  feedback,
  summary,
  error,
  awaitingAdvance
}
```

Important invariants:

- `phase === 'dashboard'` means `session === null` and `summary === null`
- `phase === 'session'` means `session !== null`
- `phase === 'summary'` means `summary !== null`
- `awaitingAdvance === true` means the current card is already marked and must not be submitted again
- `session.currentCard`, `session.progress`, and `session.currentStage` are derived service fields and must stay serialisable
- test-mode `results` are de-duplicated by slug during restore because the contract is single-attempt per word

## Domain events

The service now emits:

- `spelling.retry-cleared`
  - Fired when a learner successfully clears a retry or correction step after a miss
- `spelling.word-secured`
  - Fired when a spelling crosses into secure stage
- `spelling.mastery-milestone`
  - Fired when total secure-word count hits a milestone such as 1, 5, 10 or 25
- `spelling.session-completed`
  - Fired when a round finalises to a summary

The platform runtime may then derive additional platform-wide events such as `platform.practice-streak-hit` from those subject events.
The spelling reward subscriber translates `spelling.word-secured` into monster/codex reaction events and persisted reward history.
Codex display counts are projected from current spelling progress (`stage >= 4`) rather than from reward history, so imported or repaired learner progress cannot drift from the analytics secure counts.

Current spelling Codex stage thresholds are:

- Inklet and Glimmerbug: Stage 1 at 10 secure words, Stage 2 at 30, Stage 3 at 60, Stage 4 at 90
- Phaeton: Stage 1 at 25 combined secure words, Stage 2 at 95, Stage 3 at 145, Stage 4 at 200

Phaeton uses the combined secure-word count directly. It does not require both Year 3-4 and Year 5-6 pools to cross the same threshold first.

## Legacy behaviors intentionally preserved

These were kept on purpose:

- smart-review weighted selection and trouble-drill fallback behavior
- live spelling cards hide family cues during recall; family words only surface once the flow allows them
- new words in learning mode need two clean hits in the same round before the round is done
- wrong first attempt enters retry without revealing the answer
- wrong retry enters correction and then schedules one clean blind return later in the round
- corrected words still count as due again for future review
- SATs test mode is single-attempt per word
- skipping only works in learning question phase and pushes the word later in the round
- marked cards auto-advance after the preserved short delay instead of needing an extra manual confirmation step
- the preserved shortcut loop remains available inside active Spelling practice (`Esc`, `Shift+Esc`, `Alt+1/2/3`, `Alt+S`, `Alt+K`) while still avoiding cross-subject collisions in the wider shell
- production dictation audio is generated through the Worker-side OpenAI TTS proxy by default, with browser speech synthesis kept as the client fallback
- stage progression and due-day scheduling still come from the preserved legacy engine

## Pass 10 parity notes

Pass 10 was a parity-hardening pass rather than a new-feature pass.

What was brought back into line with the direct legacy baseline:

- live cards no longer leak family cues during recall
- retry / correction controls use the preserved phase-specific wording again
- live sessions confirm before they are abandoned explicitly
- the rebuilt slice now auto-advances after marked cards with the same broad timing intent as the older single-page flow
- the practical keyboard loop was restored inside the active Spelling practice surface

What remains intentionally different:

- platform-level resume across learner switches/navigation/reload still stays broader than legacy
- the full searchable word-bank drill surface is still not rebuilt
- provider/model/voice/rate TTS controls and warm-up behaviour are still deferred

See `docs/spelling-parity.md` for the full matrix and the explicit remaining deltas.

## Pass 11 content model notes

Pass 11 moves spelling word lists, words, and sentence banks into a versioned content boundary.

What changed:

- operators edit a draft bundle through import/export, reset, and publish controls
- learner sessions read the current published release snapshot only
- the runtime service is rebuilt after content mutations so new published content is picked up without leaking unpublished draft rows
- explicit word starts fail cleanly if the slug is absent from the published snapshot
- event metadata now follows the injected content snapshot, so secured-word and retry-cleared events stay aligned with edited content

The service remains content-consumer only.
Draft validation, portable import/export, publishing, and D1 persistence live in `src/subjects/spelling/content/*` and the Worker content routes.

## Bug fixes made in this hardening pass

These change behavior only where the previous rebuild was unsafe or inconsistent:

- injected randomness is now actually used at runtime, so seeded sessions are reproducible
- active spelling sessions are serialisable and can be resumed safely from persisted subject UI state
- empty submissions now produce explicit validation feedback instead of a silent no-op
- duplicate submissions after a card is already marked are ignored, which prevents double-counting in test mode
- malformed or partial persisted spelling state now falls back safely instead of relying on implicit structure

## Remaining ambiguities in the preserved legacy engine

These are still intentionally preserved rather than reinterpreted in this pass:

- the exact smart-review weighting constants and repeat penalties are legacy values, not yet re-derived from first principles
- “secure” still means stage `>= 4` in the preserved schedule, not a newly designed mastery threshold
- correction-flow prompt counting follows the legacy implementation, including how retry and correction attempts contribute to session prompt totals
- monster assignment still tracks the historical year-band split, not a future cross-subject reward taxonomy
- session summaries still describe “secure for today” and “due again” using legacy wording rather than a newly redesigned pedagogy vocabulary
