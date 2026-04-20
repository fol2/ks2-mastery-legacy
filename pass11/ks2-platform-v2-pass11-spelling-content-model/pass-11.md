# Pass 11

This pass moves English Spelling content into a versioned content boundary.

What is now true:

- spelling word lists, words, and sentence banks live in a versioned draft/published content model
- runtime reads are pinned to published release snapshots, not live draft rows
- the Worker has account-scoped spelling-content routes and storage
- content validation catches duplicate words, malformed entries, missing year metadata, broken sentence references, and invalid publish states
- content import/export tooling exists without turning the repo into a full CMS
- the spelling engine still stays content-consumer only; it does not own draft/publish logic

Scope remains intentionally small:

- no second subject
- no giant editorial system
- no pedagogy redesign
- browser boot still local-first
