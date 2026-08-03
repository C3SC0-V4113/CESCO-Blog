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

- `/`
- `/blog`
- the post detail route
- related section routes such as `/analisis` or `/opiniones`
- related tag/game pages

Cache tags and path-based invalidation are the preferred model when the cache
phase is implemented.

## Public route model

- `/` — editorial home with recent and featured content
- `/blog` — full post listing
- `/analisis` — video game analysis
- `/analisis/[slug]` — analysis with technical metadata and no score
- `/opiniones` — personal/editorial opinion
- `/opiniones/[slug]`
- `/juegos/[slug]` — future game page with related content
- `/tags/[slug]` — topic navigation
- `/buscar` — future search

## Consequences

### Positive

- Preserves fast public pages without forcing rebuilds for every publish.
- Keeps cache invalidation tied to editorial actions.

### Negative

- Requires disciplined cache tagging and invalidation when publishing ships.
- Draft and admin routes must never be cached as public content.
