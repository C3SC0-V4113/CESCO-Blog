# ADR-0012: Extend the editorial schema for authors, series, and analysis metadata

## Status

Accepted

## Date

2026-08-03

## Context

The current schema models posts, localizations, revisions, media, games, tags,
platforms, and genres. It does not model who wrote a post, how posts group into
editorial series, which posts are featured, or the metadata specific to an
analysis piece.

ADR-0013 requires an `author` for the `BlogPosting` structured data and a
visible byline. ADR-0014 requires a stable ordering key and a way to exclude
non-servable content. None of that is expressible today.

Two derived values — reading time and table of contents — are also needed at
render time. Computing them per request means parsing `content_json` inside the
Worker on every uncached render, which competes for a constrained CPU budget
(see ADR-0016).

## Decision

Extend the D1/Drizzle schema:

| Addition          | Form                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| Authorship        | `authors` table plus `posts.author_id` foreign key                                   |
| Series            | `collections`, `collection_localizations`, `collection_posts` with explicit ordering |
| Featured          | `post_localizations.featured_at`, nullable                                           |
| Analysis metadata | `post_analysis_metadata` with `played_platform_id` referencing `platforms`           |
| Derived values    | `post_revisions.reading_time_minutes` and `post_revisions.toc_json`                  |

Use a simple foreign key for authorship rather than a `post_authors` join table.
The site has one author. Migrating to many-to-many later is creating the join
table, backfilling from the column, and dropping it — a small, well-understood
migration that does not justify carrying the join table now.

Store `reading_time_minutes` and `toc_json` on `post_revisions` rather than
deriving them per request. `post_revisions` is immutable: it carries `created_at`
and no `updated_at`, and a published revision is never edited in place. A value
derived from an immutable row cannot drift from its source, so the usual argument
against persisting derived data does not apply.

Derive table-of-contents anchors from the `content_json` block IDs, not from
slugified heading text. Block IDs are already the stable identity used by
`post_revision_media`. Anchors derived from heading text break every deep link
and every table-of-contents entry when a heading is reworded.

Mirror the post structure for collections: `collections` is the locale-neutral
aggregate with an `editorial_state` switch, `collection_localizations` holds the
per-locale slug, title, and lifecycle `status`, and `collection_posts` carries
explicit ordering. Because a collection localization can be published and later
withdrawn, it carries `first_published_at` under the same contract as
`post_localizations`, so the ADR-0010 URL lifecycle applies to series URLs
identically. Collection slugs have no history table yet and are therefore treated
as immutable after publication.

Reference `platforms` for the platform a game was played on. The table already
exists and free text would fragment the same platform across spellings.

Model review-copy disclosure as locale-neutral structured data — a boolean and a
provider name — with the visible sentence localized from UI strings. If a
free-form disclosure note is ever needed, it is localized content and must be
modeled per localization, not on the neutral row.

## Consequences

### Positive

- Structured data and bylines have a real source instead of a hardcoded name.
- Series can order posts across sections, connecting analysis and opinion.
- Featured content needs one nullable column rather than a slot-management
  table the site has no use for.
- Article pages render without reparsing rich text, protecting the CPU budget.
- Anchors survive copy edits.

### Negative

- Publishing must compute the derived fields, and that logic must be shared
  between the seed script and the future admin rather than duplicated.
- Adding a second author later requires a migration, even though it is a small
  one.
- `post_analysis_metadata` applies only to `analysis` posts, so application code
  carries a section-dependent optional relationship.

## Related Decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0005](0005-use-drizzle-for-d1-schema-and-migrations.md)
- [ADR-0006](0006-model-editorial-media-and-social-preview-images.md)
- [ADR-0008](0008-adopt-bilingual-localized-publishing.md)
- [ADR-0013](0013-define-server-first-seo-metadata-contract.md)
- [ADR-0017](0017-bootstrap-content-with-seed-script.md)
