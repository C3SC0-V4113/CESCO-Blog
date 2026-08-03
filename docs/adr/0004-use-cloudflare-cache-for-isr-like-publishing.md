# ADR-0004: Use Cloudflare cache for ISR-like publishing

## Status

Accepted

## Context

Published posts should become visible without a full rebuild, while public pages
should remain fast. Astro on Cloudflare does not use Vercel-style ISR directly,
but Cloudflare caching and invalidation can provide the same product behavior.

## Decision

Use Cloudflare CDN/Workers cache patterns for ISR-like publishing in a later
phase.

Publishing a post should eventually invalidate or refresh:

- `/es` and `/en`
- localized listing routes such as `/es/blog` and `/en/blog`
- the localized post detail route for the published language
- related localized section routes such as `/es/analisis`, `/en/analysis`,
  `/es/opiniones`, or `/en/opinions`
- related tag/game pages

Cache tags and path-based invalidation are the preferred model when the cache
phase is implemented.

## Public route model

- `/es` and `/en` — editorial home with recent and featured content
- `/es/blog` and `/en/blog` — full post listing
- `/es/analisis` and `/en/analysis` — video game analysis
- `/es/analisis/[slug]` and `/en/analysis/[slug]` — analysis with technical
  metadata and no score
- `/es/opiniones` and `/en/opinions` — personal/editorial opinion
- `/es/opiniones/[slug]` and `/en/opinions/[slug]`
- `/es/juegos/[slug]` and `/en/games/[slug]` — future game page with related
  content
- `/es/etiquetas/[slug]` and `/en/tags/[slug]` — topic navigation
- `/es/buscar` and `/en/search` — future search

## Consequences

### Positive

- Preserves fast public pages without forcing rebuilds for every publish.
- Keeps cache invalidation tied to editorial actions.

### Negative

- Requires disciplined cache tagging and invalidation when publishing ships.
- Draft and admin routes must never be cached as public content.
