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
- related collection/series pages
- the RSS endpoint for the published language
- the sitemap
- `301` redirect responses for retired slugs and `410` responses for withdrawn
  localizations

> **Concreted by [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag.md).**
> The cache-tag model preferred here is confirmed: Cloudflare made every purge
> method available on all plans on 2025-04-01, so tags are usable on this
> project's plan. ADR-0011 defines the tag vocabulary and the purge triggers.

## Public route model

Served from `checkpoint.cescovalle.com` per
[ADR-0016](0016-host-blog-on-checkpoint-subdomain.md).

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
- `/es/series/[slug]` and `/en/series/[slug]` — editorial collections
- `/es/buscar` and `/en/search` — future search
- `/sitemap.xml`, `/es/rss.xml`, `/en/rss.xml`, `/robots.txt` — distribution
  endpoints, see [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)

## Consequences

### Positive

- Preserves fast public pages without forcing rebuilds for every publish.
- Keeps cache invalidation tied to editorial actions.

### Negative

- Requires disciplined cache tagging and invalidation when publishing ships.
- Draft and admin routes must never be cached as public content.
