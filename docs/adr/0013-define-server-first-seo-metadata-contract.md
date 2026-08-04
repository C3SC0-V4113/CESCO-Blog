# ADR-0013: Define the server-first SEO metadata contract

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0008 states that rendered pages must use the URL locale for `<html lang>`,
canonical URLs, reciprocal `hreflang`, `x-default`, SEO metadata, and Open Graph
metadata. It does not say which column each value comes from.

That gap matters most for dates. `post_localizations` carries an `updated_at`
column that bumps whenever the row is touched — changing `featured_at`, moving
the published revision pointer, correcting a slug. Using it for `dateModified`
signals a content change to search engines every time a post is featured on the
home page.

Independent per-locale publishing (ADR-0008) also means the alternate set is not
symmetric. A post published only in Spanish has no English alternate to declare.

## Decision

Render all SEO metadata server-side, from the URL locale and the published
revision.

Field sources for the `BlogPosting` JSON-LD:

| Field           | Source                                             |
| --------------- | -------------------------------------------------- |
| `author`        | `authors`, via `posts.author_id`                   |
| `datePublished` | `post_localizations.first_published_at`            |
| `dateModified`  | `created_at` of the **published revision**         |
| `image`         | `posts.cover_media_id` — the clean editorial image |
| `inLanguage`    | Locale from the URL                                |
| `headline`      | Published revision `title`                         |

`dateModified` must never come from `post_localizations.updated_at`. The
published revision's `created_at` is the only value that changes when, and only
when, the published content changes.

`image` must never come from `post_revisions.og_image_media_id`. Per ADR-0015
that asset carries burned-in text and is intended for social cards, not for
structured data.

Page-level rules:

- Canonical points at the current localized URL.
- `hreflang` declares only published localizations. A locale in `draft` or
  withdrawn is absent from the alternate set.
- `x-default` points at the Spanish URL when Spanish is published; otherwise at
  the published localization that exists.
- Emit `max-image-preview:large`.
- Publication date, modification date when it differs, and the byline are
  visible in the rendered page, not only in structured data.

The sitemap's `<lastmod>` uses the **same source as `dateModified`**: the
published revision's `created_at`. One source, two consumers, and a test
asserting the two agree.

## Consequences

### Positive

- Search engines receive a modification signal only on real content changes.
- Google receives a clean editorial image for Discover and rich results rather
  than a text-heavy social card.
- The alternate set is always truthful, so partially translated posts do not
  advertise URLs that return `404`.
- Structured data and sitemap cannot contradict each other.

### Negative

- Rendering a page requires joining the published revision and the author rather
  than reading the localization row alone.
- The `hreflang` block is conditional, so both the one-locale and two-locale
  shapes need test coverage.
- Two date columns with similar names sit next to each other on the same table,
  and picking the wrong one fails silently.

## Related Decisions

- [ADR-0008](0008-adopt-bilingual-localized-publishing.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)
- [ADR-0015](0015-separate-social-card-from-editorial-cover-image.md)
