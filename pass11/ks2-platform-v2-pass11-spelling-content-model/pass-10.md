# Pass 10 — English Spelling parity hardening

This pass focuses only on English Spelling parity hardening and regression protection.

See:

- `docs/spelling-parity.md`
- `docs/spelling-service.md`

Key outcomes:

- live recall no longer leaks family cues
- retry / correction labels and placeholders now track the preserved legacy flow again
- marked cards auto-advance with preserved legacy timing
- explicit confirm-before-abandon and confirm-before-shortcut-switch are restored
- practical legacy keyboard shortcuts are restored inside active Spelling practice
- regression tests now guard the restored behaviour
