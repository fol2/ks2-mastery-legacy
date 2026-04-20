# Migration map

## Old to new responsibility map

| Old location | Problem | New location |
|---|---|---|
| `preview.html` | UI, engine, storage and session flow all mixed together | `src/subjects/spelling/service.js` + `src/subjects/spelling/module.js` + `src/platform/*` |
| `src/generated/legacy-entry.generated.jsx` | Build-generated global runtime | Removed in favour of explicit ES module imports |
| `src/practice.jsx` spelling branch | Spelling is hard-coded into shared flow | `src/platform/core/subject-registry.js` + `spellingModule` contract |
| `window.*` frontend coupling | Hidden runtime dependencies | explicit imports + action dispatch |
| `worker/lib/store.js` subject-specific JSON columns | Does not scale to six subjects | `worker/migrations/0001_platform.sql` with generic `child_subject_state` |
| `monster` runtime events mixed into answer flow | Soft boundary between learning and reward | `src/platform/game/monster-system.js` fed by mastery events |

## What was preserved directly

- statutory spelling word data
- sentence banks
- deterministic spelling session logic
- word-family and year-group routing
- core reward art assets
- overall warm card-based UI direction

## What was intentionally left as a placeholder

- arithmetic engine
- reasoning engine
- grammar engine
- punctuation engine
- reading engine
- advanced quest systems
- cosmetics and progression economy
- full server-backed subject execution beyond the generic repository API skeleton

## Why the placeholders matter

These are not empty cards.

They prove the architecture is now shaped around a platform contract. The next subject should be added by implementing a module and a service, not by cutting more branches into the shell.
