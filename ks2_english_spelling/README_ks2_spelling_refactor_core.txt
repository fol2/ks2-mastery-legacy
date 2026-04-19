KS2 Spelling Sprint - structural refactor core

What changed
- Rebuilt the app core around clearer modules:
  - WordRepository
  - Store
  - AudioService
  - WordSelector
  - SessionManager
  - View
  - App
- Preserved the same sentence-bank contract and the same external sentence-bank-01.js to sentence-bank-06.js files.
- Kept the same localStorage progress key so existing learner progress should continue to load.
- Exposed a small global hook for future extension:
  - window.KS2SpellingSprintApp

Focused fixes included in this pass
- Global Alt keyboard shortcuts no longer fire while typing in search / API key / other fields.
- SATs test mode still blocks blank submission.
- Test mode still hides cloze context.
- Gemini warm-up no longer prefetches in the background when auto-play is off.
- Session timers and audio are reset through one central path when switching rounds / going home / changing learner.
- Word-bank click and mistake-list click use event delegation instead of repeated per-pill listeners.

Notes
- This pass is about code structure, not new learning features.
- Sentence-bank content is unchanged in this pack.
- Browser and API TTS support remain in place.

Smoke checks completed
- JS syntax check passed.
- Stubbed smoke test confirmed:
  - app initialises
  - Smart Review starts
  - SATs test starts
  - blank test submit does not advance
  - test card hides sentence context
  - Alt shortcut is ignored while typing in search
