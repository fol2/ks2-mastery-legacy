# Spelling content model

This pass moves English Spelling content out of long-lived code blobs and into a small versioned content domain.

It keeps two rules explicit:

1. operators edit a **draft** bundle
2. the learner runtime only reads a **published release snapshot**

That means content operations can grow later without pulling publishing logic into the spelling engine or letting live draft edits leak into active sessions.

## Scope

This model currently covers:

- word lists
- words
- sentence entries and sentence variants
- year-group metadata
- tags
- source notes and provenance
- draft vs published state
- release versions and publication pointers

It does **not** try to become a general CMS.
It is only the minimum versioned content layer needed to stop treating spelling content as permanent code.

## Domain model

The persisted subject-content bundle is:

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

There is one active draft for the spelling subject.

```txt
{
  id,
  state: 'draft',
  version,
  title,
  notes,
  sourceNote,
  provenance,
  createdAt,
  updatedAt,
  wordLists,
  words,
  sentences
}
```

The draft is the editable operator-facing source.
It may change over time.
It is validated before import and before publish.

### Word lists

```txt
{
  id,
  title,
  yearGroups,
  tags,
  wordSlugs,
  sourceNote,
  provenance,
  sortIndex
}
```

Word lists are the authoring/grouping boundary.
They keep year-group metadata explicit and give future operator tooling a stable unit smaller than “all spelling content”.

### Words

```txt
{
  slug,
  word,
  family,
  listId,
  yearGroups,
  tags,
  accepted,
  sentenceEntryIds,
  sourceNote,
  provenance,
  sortIndex
}
```

`sentenceEntryIds` point at sentence rows rather than embedding long sentence arrays directly in the word row.
That keeps sentence banks versionable and easier to validate.

### Sentence entries / variants

```txt
{
  id,
  wordSlug,
  text,
  variantLabel,
  tags,
  sourceNote,
  provenance,
  sortIndex
}
```

A word can point at one or more sentence entries.
The published runtime snapshot later collapses those back into the legacy runtime shape the preserved spelling engine expects.

### Releases

A published release is immutable.

```txt
{
  id,
  state: 'published',
  version,
  title,
  notes,
  sourceDraftId,
  sourceNote,
  provenance,
  publishedAt,
  snapshot
}
```

Each release stores a generated runtime snapshot.
That is deliberate.
The runtime should not rebuild itself from live draft rows at session start.

### Publication pointer

```txt
{
  currentReleaseId,
  publishedVersion,
  updatedAt
}
```

The publication pointer decides what the learner runtime reads.
The runtime does not infer “latest” from the draft.
It follows the current published release.

## Draft vs published behaviour

### Draft rules

- Draft rows are editable.
- Draft rows can be imported/exported.
- Draft rows must validate before publish.
- Draft rows are not used by the learner runtime just because they exist.

### Publish rules

- Publishing validates the full bundle first.
- Publishing generates a new immutable runtime snapshot from the current draft.
- Publishing appends a new release with the next integer version.
- Publishing moves the publication pointer to that new release.
- Publishing does not mutate older releases.

### Runtime rules

- `createSpellingService()` can now receive a `contentSnapshot`.
- The main shell rebuilds the spelling service from `spellingContent.getRuntimeSnapshot()`.
- `getRuntimeSnapshot()` resolves the currently published release snapshot only.
- If an explicit word is requested and it does not exist in the published snapshot, session start now fails cleanly instead of silently falling back to a different round.

That last rule matters for safety: content-pinning should not quietly drift into a different session than the caller asked for.

## Runtime snapshot shape

Published releases store a compact runtime snapshot compatible with the preserved spelling engine.

```txt
{
  generatedAt,
  words,
  wordBySlug
}
```

Each runtime word includes the legacy engine fields the existing spelling PoC already expects, including sentence arrays and family-word groupings.

This keeps the subject engine deterministic and unchanged in its core pedagogy while letting content-management logic live outside it.

## Schema and backend support

A new Worker/D1 table stores account-scoped subject content bundles.

### `account_subject_content`

```txt
account_id
subject_id
content_json
updated_at
updated_by_account_id
```

Current use:

- `subject_id = 'spelling'`
- account-scoped draft/release content storage
- content writes protected by the same account revision / idempotency mutation policy already introduced in Pass 9

New Worker routes:

- `GET /api/content/spelling`
- `PUT /api/content/spelling`

The Worker validates incoming content bundles and rejects invalid ones with explicit validation details.

## Repository and service boundary

The content layer is deliberately separate from the subject engine.

### Local repository

`createLocalSpellingContentRepository()`

- stores the content bundle in local storage
- falls back to the seeded bundle if no stored content exists

### API repository

`createApiSpellingContentRepository()`

- hydrates from `/api/content/spelling`
- writes with account-scoped mutation metadata
- tracks the current account revision for replay-safe writes

### Content service

`createSpellingContentService()` owns:

- reading and writing the content bundle
- validation
- runtime-snapshot resolution
- portable import/export
- publish
- reset-to-seeded
- summary generation for the thin operator UI

The spelling engine never owns draft/release rules.

## Import / export pipeline

Source-of-truth content file:

- `content/spelling.seed.json`

Generated runtime files:

- `src/subjects/spelling/data/content-data.js`
- `src/subjects/spelling/data/word-data.js`

Available scripts:

```bash
npm run content:seed
npm run content:validate
npm run content:generate
npm run content:export
npm run content:import -- <input.json> [output.json]
```

### Pipeline intent

- `content:seed`
  - builds the initial content bundle from the preserved legacy vendor files
- `content:validate`
  - checks the seed bundle directly
- `content:generate`
  - compiles the published snapshot into runtime modules
- `content:export`
  - writes a portable content export from the source bundle
- `content:import`
  - validates a portable payload before writing it back to the source bundle

The generated runtime data is therefore downstream from the published snapshot, not the authoring surface itself.

## Validation rules now enforced

Validation currently catches:

- duplicate words
- malformed word entries
- malformed sentence entries
- missing year-group metadata on lists and words
- missing or cross-linked sentence references
- invalid publish states
- duplicate release ids or versions
- broken publication pointers

Those checks run in both the content service and the Worker route.

## Minimal operator-facing management hooks

The shell now exposes a thin Spelling Settings card for content operations.

Current hooks:

- view content counts and validation status
- view published release id/version
- export content
- import content
- publish current draft
- reset to the bundled baseline

This is intentionally a placeholder operator surface, not a CMS.
It is enough to prove the content boundary and future administration direction without widening the UI into an editorial system.

## Seeded legacy baseline

The initial spelling content bundle was seeded from:

- `legacy/vendor/word-list.js`
- `legacy/vendor/word-meta.js`
- `legacy/vendor/sentence-bank-*.js`

That means the content model starts from the same preserved English Spelling material already used by the rebuilt PoC.
This pass changes the storage and publication shape, not the underlying spelling curriculum.

## Remaining deltas / limitations

These are still intentionally simple after this pass:

- there is no full editorial CMS
- there is no release rollback UI yet
- there is no per-row audit trail beyond bundle-level provenance/source notes
- there is no content diff viewer yet
- only English Spelling content is modelled this way today
- signed-in production boot uses the API content repository; direct file/local development mode uses the local content repository

That is enough for this pass.
The repo now has a manageable content boundary with explicit draft/publish/release rules, while the learner runtime stays deterministic and pinned to published snapshots.
