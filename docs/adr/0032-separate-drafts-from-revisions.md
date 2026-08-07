# ADR-0032: Separate drafts from revisions

## Status

Accepted

## Date

2026-08-07

## Context

The editor arrives in the admin chain and needs somewhere to put work in
progress. `post_revisions` is the obvious candidate and the wrong one, but the
reason is not a matter of taste — the schema already committed to something
incompatible.

Three properties are load-bearing today:

- `post_revisions` has a unique index on `(post_localization_id, version)`, so
  versions are sequential and mean something.
- `reading_time_minutes` and `toc_json` are persisted on the revision rather than
  derived per request, and the schema justifies that with one sentence: "safe to
  persist because a revision is immutable, so the value cannot drift from its
  source" (ADR-0012).
- `post_revision_media` cascades from `revision_id`, so every revision carries
  its own set of placement rows — `block_id`, `position`, `alt_text`, `caption`.

ADR-0024 adds the cost that settles it. Syntax highlighting is stored inside
`content_json`, and that ADR already records the consequence: "Storing
highlighted output inside `content_json` enlarges revisions." It also places the
media walk "on save" — the pass that collects image nodes and upserts
`post_revision_media`.

Put together: if every save creates a revision, then every few keystrokes writes
a full copy of the document with its highlighted output, re-runs the media walk,
and increments a version number. The table stops being editorial history and
becomes an autosave log, while the immutability that the derived columns rest on
survives only in name.

The question ADR-0024 left open — does each save create a version, or only the
publish — could not be answered when it was written, because there was no
rendering to measure against. There is now.

## Decision

A revision is a **published snapshot**. Nothing else creates one.

Work in progress lives in a new `post_drafts` table: **one mutable row per
`post_localization_id`**, upserted by autosave, holding the same editable fields
a revision carries plus its own `updated_at`.

Publishing is the only transition between them:

1. Read the draft row.
2. Insert a `post_revisions` row with `version = max(version) + 1`.
3. Walk `content_json`, upsert `post_revision_media` for that revision.
4. Point `post_localizations.published_revision_id` at it.
5. Purge by cache tag (ADR-0011).

The draft row survives publication rather than being deleted, so reopening the
editor after publishing shows what is published instead of an empty document.

`version` therefore counts publications, which is what a reader of the table
would assume it counts.

## Consequences

### Positive

- The immutability claim in the schema becomes true rather than aspirational,
  and the derived columns keep the justification they were given.
- Autosave costs one `UPDATE` against one row. No version churn, no media walk,
  no duplicated highlighted content.
- The media walk runs once per publication, at the moment its output is actually
  needed. ADR-0024 calls it "bespoke logic with no framework support" and warns
  that a bug there desynchronizes placements — running it rarely and
  deliberately is worth more than running it constantly.
- Revision history reads as an editorial record: every row was public at some
  point.

### Negative

- A new table and a migration before the editor can be built.
- **No recovery of intermediate states.** Work that was never published leaves
  no trail beyond the current draft, so an editor who overwrites their own draft
  and wants yesterday's wording cannot get it back. This is the real cost of the
  decision and it is accepted deliberately: the alternative buys that recovery
  by making every autosave permanent.
- Two places now hold editable content, and the publish path is the only thing
  keeping them consistent. That path needs integration tests, not review.

### Risks

- Nothing yet stops a future writer from inserting a revision outside the
  publish path. If that happens more than once, the constraint belongs in
  `src/actions/` as the single writer (ADR-0031) rather than in a convention.

## Implementation notes

- The migration lands with the editor work, not before it. A table with no
  writer is the dead code ADR-0031 and the export rule both argue against.
- `post_drafts` does **not** get a `version` column. Its absence is the point.

## Related decisions

- [ADR-0024](0024-adopt-tiptap-for-the-editorial-content-pipeline.md) — left this
  boundary open; this record closes it.
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md) —
  the derived columns whose justification depends on immutability.
- [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag-on-editorial-events.md)
  — publication is a purge event.
- [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md) — the publish
  transition belongs in `src/actions/`.
