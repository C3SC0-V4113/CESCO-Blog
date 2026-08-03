# ADR-0002: Use D1 for content storage

## Status

Accepted

## Context

The blog needs to store drafts, published posts, SEO metadata, and structured
game metadata. The goal is to minimize operational complexity while staying
inside the Cloudflare platform.

## Decision

Use Cloudflare D1 as the primary content database.

The initial content model was later localized by
[ADR-0008](0008-adopt-bilingual-localized-publishing.md) and gained a
post-level archival switch in
[ADR-0009](0009-use-post-editorial-state-for-global-archive.md). The current
content model is:

- `Post`
  - locale-neutral aggregate for `section`, `editorialState`, game metadata
    link, and cover media
  - `section`: `analysis | opinion`
- `PostLocalization`
  - `locale`: `es | en`
  - localized `slug`
  - localized `status`: `draft | published | archived`
  - `publishedRevisionId`, `publishedAt`
- `PostRevision`
  - localized `title`, `excerpt`, `content`
  - localized `seoTitle`, `seoDescription`, `canonicalUrl`
  - localized Open Graph/social preview metadata
- `GameMetadata` for analysis posts only:
  - `gameTitle`, `platforms`, `developer`, `publisher`, `releaseDate`, `genres`
  - no numeric score

Current editorial sections are intentionally limited to analysis as the primary
section and opinion as the secondary section.

## Considered options

### D1

- **Pros**: Cloudflare-native, SQLite-based, low operational overhead, direct
  Worker binding support.
- **Cons**: Different operational model than traditional MySQL/PostgreSQL.

### MySQL through Hyperdrive

- **Pros**: Familiar SQL database model and good fit for existing MySQL hosts.
- **Cons**: Requires an external database provider and more moving parts.

## Consequences

### Positive

- Simplifies the stack for a solo editorial blog.
- Keeps content reads and writes close to the Astro Cloudflare runtime.

### Negative

- Future advanced search or analytics may require an additional service.
- Schema migrations must be designed carefully before the admin editor ships.
