# ADR-0010: Define public URL lifecycle for localized posts

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0008 lets Spanish and English publish independently, and ADR-0009 adds an
aggregate archive switch. Both decisions make it possible for a public URL to
stop being servable after it was already public and indexed.

Neither ADR says what those URLs should return. Without an explicit rule the
default implementation is a `404` for every non-servable URL, which discards the
distinction between content that never existed and content that was retired.
Search engines treat those cases differently.

Slugs are also mutable. `post_localizations.slug` can change after publication,
which breaks the original URL and any links pointing at it.

A subtler problem sits underneath both cases: the schema has no way to express
"this localization was public at some point". `post_localizations.status` is
`draft` both for a localization that was never published and for one that was
published and then withdrawn. If `published_at` is cleared on unpublish — the
intuitive implementation — that information is destroyed permanently.

## Decision

Define the public response for every localized post URL:

| Condition                                        | Response                  |
| ------------------------------------------------ | ------------------------- |
| Localization never published                     | `404`                     |
| Localization published and later withdrawn       | `410 Gone`                |
| Slug present in `post_localization_slug_history` | `301` to the current slug |
| Localization published and servable              | `200`                     |

`410` is determined **exclusively** by `post_localizations.first_published_at`
being non-null. `posts.editorial_state = 'archived'` controls whether content is
served; it never decides between `404` and `410`. A globally archived post whose
English localization was never published still returns `404` at the English URL.

Split the publication timestamp into two columns with distinct contracts:

- `first_published_at` — set on the first publication, never cleared, never
  overwritten. Source of `datePublished` and sole determinant of `410`.
- `current_published_at` — updated on every publication event for editorial
  bookkeeping. Never cleared on unpublish. Never affects public ordering.

Adopt this invariant across the schema:

> `status` answers _what this is now_. Timestamps answer _what happened_. A null
> timestamp is never used to encode a state.

For slugs:

- Retired slugs are reserved permanently. No future post may reuse them.
- Slug resolution checks live slugs in `post_localizations` first, then falls
  back to `post_localization_slug_history`.
- Renaming A to B and later B to C rewrites every history row that pointed at B
  so it points at C. A retired slug always resolves in a single hop; redirect
  chains are not allowed.

Permanent slug reservation is an **application invariant, not a database
constraint**. SQLite cannot express uniqueness spanning `post_localizations` and
`post_localization_slug_history`, so slug assignment must query both tables and
an automated test must cover the reuse attempt.

The `404`/`410` rule and the immutable-timestamp contract apply to every
publishable localized entity, not only to posts. `collection_localizations`
carries its own `first_published_at` under the same contract, so a withdrawn
series URL behaves like a withdrawn article URL. Any future publishable entity
must carry the same column rather than reintroducing a null-state encoding.

Collections do not yet maintain slug history. Their slugs are treated as
immutable after publication until a history table is added, because a mutable
slug with no history is the one combination that silently breaks links.

## Consequences

### Positive

- Retired URLs tell crawlers the content is intentionally gone instead of
  implying it may return.
- Renaming a slug preserves inbound links and accumulated ranking signal.
- `datePublished` stays stable across unpublish and republish cycles.
- The timestamp invariant prevents a whole family of state-encoding bugs beyond
  this ADR.

### Negative

- Public route handlers must resolve three tables before answering, and must
  distinguish `404` from `410` on every miss.
- Slug reuse prevention depends on application code and its test, not on a
  database constraint.
- Renaming a slug requires rewriting history rows rather than appending one, so
  the rename path is more than a single insert.

## Related Decisions

- [ADR-0008](0008-adopt-bilingual-localized-publishing.md)
- [ADR-0009](0009-use-post-editorial-state-for-global-archive.md)
- [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag.md)
- [ADR-0013](0013-define-server-first-seo-metadata-contract.md)
