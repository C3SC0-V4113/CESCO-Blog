# 0009: Use post editorial state for global archive

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0008 moved publication lifecycle to `post_localizations.status` so Spanish
and English versions can be drafted, published, and archived independently.
However, editors still need an aggregate-level control to hide an entire post
across every localization without rewriting each language status.

Using `posts.status` for this global switch is ambiguous because localized
publication status already uses `post_localizations.status`. The aggregate field
needs to describe editorial visibility for the whole post, not whether any one
language is published.

## Decision

Replace post-level `posts.status` with `posts.editorial_state`.

The Drizzle model exposes it as `Post.editorialState`, mapped to the SQL column
`editorial_state`, with values:

- `active`
- `archived`

The default is `active`. Public post queries must require both:

- `posts.editorial_state = 'active'`
- `post_localizations.status = 'published'`

`post_localizations.status` remains the source of truth for each language's
publication lifecycle.

## Consequences

### Positive

- Editors can archive the post aggregate once to hide all localizations.
- Localized publication remains independent per language.
- The schema separates aggregate editorial visibility from localized publishing
  status.

### Negative

- Public queries must join and filter on both aggregate and localization state.
- Existing references to post aggregate status must be renamed to editorial
  state.

## Related Decisions

- [0002](0002-use-d1-for-content-storage.md): Use D1 for content storage.
- [0008](0008-adopt-bilingual-localized-publishing.md): Adopt bilingual
  localized publishing.
