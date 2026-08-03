# 0008: Adopt bilingual localized publishing

## Status

Accepted

## Date

2026-08-03

## Context

Cesco Blog needs Spanish and English public content. URLs should make the
language explicit, and editorial teams need to publish each language when it is
ready instead of forcing all translations to ship together.

The existing post model stored slug, published revision, publish timestamp, SEO,
and Open Graph data as if every post had one language. That would make localized
URLs, translated SEO, and independent language publishing difficult to model.

## Decision

Use Astro i18n with prefixed routes for both supported languages:

- `es` is the default locale.
- Public URLs are prefixed with `/es` or `/en`, including Spanish.
- Requests to the unprefixed default route redirect to the prefixed Spanish
  route.
- Public route segments are localized, for example `/es/analisis/[slug]` and
  `/en/analysis/[slug]`.

Make `posts` a locale-neutral aggregate and add `post_localizations` for
language-specific slug, status, published revision, and publish timestamp.
Attach `post_revisions` to a localization instead of directly to a post, so
title, excerpt, rich content, canonical URL, SEO fields, and Open Graph fields
are language-specific.

Rendered public pages must use the locale from the URL for `<html lang>`,
canonical URLs, reciprocal `hreflang` alternates, `x-default`, SEO metadata, and
Open Graph metadata. Equivalent Spanish and English pages are localized
alternates, not duplicates canonicalized into one language.

Admin routes remain under `/admin` and are not localized public content.

## Consequences

### Positive

- Spanish and English can use language-specific slugs and metadata.
- Each language can be drafted, reviewed, and published independently.
- The shared post aggregate can still hold cross-language `editorial_state`,
  section, game association, and cover media.
- URL structure is explicit and stable for SEO.

### Negative

- Application code must enforce that `published_revision_id` belongs to the same
  localization because the pointer remains indexed text to avoid a circular D1
  foreign key.
- Queries for public posts now join through `post_localizations`.
- Route files will need localized public page structure in a later slice.

## Related Decisions

- [0002](0002-use-d1-for-content-storage.md): Use D1 for content storage.
- [0005](0005-use-drizzle-for-d1-schema-and-migrations.md): Use Drizzle for D1
  schema and migrations.
- [0009](0009-use-post-editorial-state-for-global-archive.md): Use post editorial
  state for global archive.
