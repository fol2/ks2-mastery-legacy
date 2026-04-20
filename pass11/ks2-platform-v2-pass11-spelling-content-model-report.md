# KS2 Platform v2 — Pass 11 report

## Scope

This pass is **only** about turning English Spelling content into a manageable, versioned content model.

It follows the already-established platform guarantees from:

- Pass 6 — subject runtime containment + golden-path smoke coverage
- Pass 7 — persistence honesty and degraded-state surfacing
- Pass 8 — real D1-backed Worker backend + learner ownership model
- Pass 9 — mutation safety, revisions, idempotency, and stale-write handling
- Pass 10 — English Spelling parity hardening and regression protection

Those earlier passes remain the source of truth.
This pass does **not** add a second subject, a framework rewrite, or a full editorial CMS.

## Goal

Stop treating English Spelling educational content as long-term code blobs.
Introduce a small versioned content model with explicit draft/publish/release rules, starting with spelling word lists and sentence banks, while keeping runtime behavior deterministic and keeping content-management rules out of the spelling engine.

## Outcome

Result: **pass completed**

The repo now has a real spelling content boundary.

What is now true:

- spelling content lives in a versioned bundle with `draft`, `releases`, and `publication`
- word lists, words, and sentence entries are stored as content rows rather than long-term runtime code blobs
- runtime reads are pinned to the **published release snapshot**, not to live draft rows
- the Worker has an account-scoped spelling-content table and API routes
- content import/export tooling exists
- validation catches duplicate words, malformed entries, missing year-group metadata, broken sentence references, and invalid publish states
- the shell exposes a small operator-facing content-management surface inside Spelling Settings
- the spelling engine stays a content **consumer** only; it does not own draft/publish logic

The English Spelling PoC still works.
No pedagogy redesign was introduced.
No content-management logic was pushed back into the subject engine.

## Seeded content baseline now under management

The seeded spelling content model was built from the preserved legacy vendor data and validated successfully.

Current seeded summary from `npm run content:validate`:

- word lists: **2**
- words: **213**
- sentence entries / variants: **2130**
- published releases: **1**
- validation errors: **0**
- validation warnings: **0**

That means the legacy spelling content is now represented as a versioned content bundle without changing the underlying curriculum material.

## Content domain model

### Bundle shape

The core bundle now has this shape:

```txt
{
  modelVersion,
  subjectId,
  draft,
  releases,
  publication
}
```

### Draft

The editable content source is stored under `draft`.
It contains:

- `wordLists`
- `words`
- `sentences`
- operator notes / source notes
- provenance
- timestamps

Draft state is explicit:

- `draft.state === 'draft'`

### Word lists

Word lists are first-class rows with:

- ids
- titles
- year groups
- tags
- ordered word references
- source/provenance notes

### Words

Words are first-class rows with:

- slug
- canonical word text
- family
- list id
- year-group metadata
- tags
- accepted spellings
- sentence-entry references
- source/provenance notes

### Sentence entries / variants

Sentence banks are now explicit sentence rows instead of only embedded arrays.
Each entry stores:

- sentence id
- owning word slug
- sentence text
- variant label
- tags
- source/provenance notes

### Published releases

Published content is immutable and versioned.
Each release stores:

- `state: 'published'`
- numeric `version`
- release metadata
- a generated runtime `snapshot`

### Publication pointer

The active runtime release is explicit through:

- `publication.currentReleaseId`
- `publication.publishedVersion`

Runtime does not infer “whatever is latest in the draft”.
It follows the publication pointer.

## Draft vs published rules now enforced

### Draft

- editable
- importable/exportable
- validated before publish
- not read directly by the learner runtime

### Publish

- validates the full bundle first
- generates a new runtime snapshot from the current draft
- appends a new immutable release
- moves the publication pointer to that release
- leaves older releases unchanged

### Runtime

- reads only the published snapshot
- stays deterministic because live draft edits do not leak into active sessions
- now rejects explicit requested words that are missing from the published snapshot instead of silently drifting into a different round

That last change is important regression protection for published-content pinning.

## Runtime data generation

There is now an explicit source-vs-generated split.

### Source of truth

- `content/spelling.seed.json`

### Generated runtime files

- `src/subjects/spelling/data/content-data.js`
- `src/subjects/spelling/data/word-data.js`

The runtime files are generated from the **published snapshot** in the source bundle.
That keeps the engine’s content input stable and explicit.

## Schema / migration changes

Added:

- `worker/migrations/0004_spelling_content_model.sql`

This introduces:

- `account_subject_content`

Purpose:

- stores account-scoped subject content bundles
- currently used for `subject_id = 'spelling'`
- keeps operator content separate from learner state

## Repository / API changes

Added:

- `src/subjects/spelling/content/model.js`
- `src/subjects/spelling/content/repository.js`
- `src/subjects/spelling/content/service.js`
- `src/subjects/spelling/content/data-transfer.js`

### Local content repository

`createLocalSpellingContentRepository()` now stores and retrieves the spelling content bundle locally.

### API content repository

`createApiSpellingContentRepository()` now hydrates and writes through:

- `GET /api/content/spelling`
- `PUT /api/content/spelling`

It uses the account-scoped mutation model from Pass 9 instead of inventing a separate write path.

### Worker backend

Updated:

- `worker/src/repository.js`
- `worker/src/app.js`

New backend behavior:

- reads spelling content by account scope
- validates incoming bundles before storing
- writes through account revision compare-and-swap + idempotent mutation receipts
- returns validation details for invalid bundles

## Import / export tooling

Added / updated scripts:

- `scripts/seed-spelling-content-from-legacy.mjs`
- `scripts/validate-spelling-content.mjs`
- `scripts/generate-spelling-content.mjs`
- `scripts/export-spelling-content.mjs`
- `scripts/import-spelling-content.mjs`

Added package scripts:

- `npm run content:seed`
- `npm run content:validate`
- `npm run content:generate`
- `npm run content:export`
- `npm run content:import`

Pipeline intent:

- seed from preserved legacy vendor files
- validate the editable bundle
- publish/generate the runtime snapshot modules
- export portable content payloads
- import portable payloads only after validation

## Validation now covered

Validation now explicitly catches:

- duplicate words
- malformed word entries
- malformed sentence entries
- missing year-group metadata
- broken sentence references
- invalid publish states
- broken publication pointers
- duplicate release ids / versions

## Minimal operator-facing management hooks

Added a small Spelling Settings management surface.

Current hooks:

- content summary counts
- validation status
- current published release id/version
- export content
- import content
- publish current draft
- reset to bundled baseline

This is intentionally a thin operator placeholder, not a CMS.

## Spelling runtime integration changes

Updated:

- `src/subjects/spelling/service.js`
- `src/subjects/spelling/events.js`
- `src/main.js`
- `src/subjects/spelling/module.js`

Key result:

- the shell rebuilds the spelling service from the published content snapshot
- content changes stay outside the engine
- event emission still works against the currently published word metadata
- the existing spelling PoC flow stays intact

## Tests added / updated

Added:

- `tests/spelling-content.test.js`
- `tests/spelling-content-api.test.js`

New coverage now proves:

- seeded spelling content validates and round-trips through the portable export format
- validation catches duplicate words and broken sentence references
- validation catches invalid publish-state / publication-pointer errors
- runtime stays pinned to the published spelling release until a new draft is published
- publishing increments release versions and updates the publication pointer
- the Worker content route rejects invalid bundles with explicit validation details
- the API content repository hydrates and persists valid content changes correctly

## Test result

Current suite result:

**73 / 73 tests passing**

## Docs updated

Added:

- `docs/spelling-content-model.md`
- `pass-11.md`

Updated:

- `README.md`
- `worker/README.md`
- `docs/repositories.md`
- `docs/spelling-service.md`

## Explicit remaining limits

Still deliberately simple after this pass:

1. there is no full editorial CMS
2. there is no visual release diff / rollback UI
3. there is no per-row audit-history UI beyond bundle-level provenance/source notes
4. only English Spelling content is modelled this way so far
5. the browser reference build still boots local-first even though the API content boundary now exists

## Why this pass is enough for now

This pass replaces “content as permanent code” with a real content boundary without dragging the repo into an oversized admin system.

The spelling engine still owns spelling pedagogy, progression, and marking.
The new content model owns draft/publish/release rules.
The runtime only consumes published snapshots.
That is the right separation for future administration and publishing work.
