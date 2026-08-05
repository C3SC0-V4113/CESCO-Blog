# ADR-0027: Localize UI strings with a typed dictionary

## Status

Accepted

## Date

2026-08-04

## Context

The site is bilingual throughout, but Astro's i18n support covers **routing**,
not content. Nothing in the project said where translated interface copy lives.

The gap was larger than it looked. ADR-0012 requires the review-copy disclosure
sentence to come "from UI strings" and ADR-0010 requires distinct copy for `404`
and `410`, but neither said what a UI string is or how a component obtains one.
Every label, date, reading-time suffix, and error page depended on a subsystem
that did not exist.

Astro's own guidance is explicit that it ships no solution and recommends a
translation dictionary.

## Decision

A typed dictionary in `src/i18n/`, with no dependency.

- `locales.ts` — the supported locale list, the default, and a narrowing helper.
  Separate from the dictionaries so runtime code can import the type without
  pulling every string into its bundle.
- `ui.ts` — one object per locale.
- `utils.ts` — `getTranslations(locale)`, locale narrowing, and date formatting
  through native `Intl`.

**Spanish is the reference locale, and English is typed against it** with
`satisfies Record<keyof typeof es, string>`. A missing English key is a
TypeScript error, not a runtime fallback.

That is the substantive departure from the common recipe, which falls back to the
default language when a key is missing. A fallback nobody sees is exactly how
half a bilingual site ends up in one language: the page renders, nothing errors,
and the gap is invisible until a reader notices. A compile error is noticed
immediately.

The locale always comes from the URL (ADR-0008), never from `Accept-Language`, so
callers pass `Astro.currentLocale` rather than negotiating.

**Spanish is region-less.** The dictionary uses neutral Spanish and `Intl`
receives the bare tag `es`, not a country variant, because the site aims at the
whole Spanish-speaking audience rather than one country. Concretely that means no
voseo, no country-specific vocabulary, and impersonal phrasing in place of
second-person address — an error message says "Esta dirección no corresponde a
ninguna publicación" rather than choosing between _buscas_, _buscás_, and _busca_.

English uses `en-US`, since date order genuinely differs by region and one had to
be chosen.

Every long-form Spanish variant renders dates identically, so the region-less tag
costs nothing at render time; it is chosen to state intent, not to change output.
The one place this cannot hold is `og:locale`, whose protocol requires a
territory — see ADR-0013, where that is treated as a formality with no editorial
meaning.

Dates use `Intl.DateTimeFormat`, which is native in workerd. No date library.

Editorial content is never translated here — it lives in `post_revisions` per
localization. This module is only for chrome, labels, and fixed copy.

Rejected alternative: an i18n library. Build machinery, a dependency, and a
message format that two locales and a few dozen keys do not justify.

## Consequences

### Positive

- Zero dependencies, consistent with public pages shipping no JavaScript.
- Locale parity is enforced by the compiler rather than by review.
- Date formatting is free and locale-correct through the platform.
- The string catalogue is greppable, diffable, and reviewable as plain code.

### Negative

- Adding a key means editing two objects; forgetting the second is a build
  failure rather than a quiet gap, which is the intent but is still friction.
- A third locale would mean a third object and a growing `satisfies` chain, at
  which point a library becomes worth reconsidering.
- Strings are not lazily loaded: both dictionaries are in the module graph
  wherever translations are used.
- Nothing detects a key that no longer has any caller.

## Related Decisions

- [ADR-0008](0008-adopt-bilingual-localized-publishing.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0019](0019-render-astro-first-with-react-islands-for-behavior.md)
