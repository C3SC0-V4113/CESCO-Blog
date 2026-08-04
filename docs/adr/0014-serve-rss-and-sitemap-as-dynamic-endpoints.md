# ADR-0014: Serve RSS and sitemap as dynamic endpoints from D1

## Status

Accepted

## Date

2026-08-03

## Context

Search engines and feed readers need an enumerable list of published URLs. The
conventional Astro answer is `@astrojs/sitemap`, which generates the sitemap at
build time by enumerating the routes Astro knows statically.

That does not work here. `astro.config.mjs` sets `output: 'server'`, post slugs
live in D1, and the `[slug]` routes have no `getStaticPaths` — they do not exist
until a request arrives. `@astrojs/sitemap` would emit the home page and the
static trust pages and not a single post.

Feeds have their own constraint. ADR-0010 makes slugs mutable with `301`
history, which disqualifies the URL as a stable item identity.

## Decision

Serve both the sitemap and the RSS feeds as SSR endpoints with
`prerender = false`, querying D1 at request time.

Do not use `@astrojs/sitemap` for post URLs. Use `@astrojs/rss` — it is an XML
builder, not a build-time generator, so it works inside an SSR endpoint.

Routes:

- `/sitemap.xml`
- `/es/rss.xml`
- `/en/rss.xml`
- `/robots.txt`

RSS item contract:

| Element    | Decision                                      |
| ---------- | --------------------------------------------- |
| Content    | Excerpt, not full content                     |
| Item count | 20 most recent                                |
| Ordering   | `first_published_at DESC`                     |
| `guid`     | `isPermaLink="false"`, stable localization ID |
| `<link>`   | Current canonical URL                         |
| `pubDate`  | `first_published_at`                          |
| Required   | `atom:link rel="self"`                        |

The `guid` must not be the canonical URL. Slugs are mutable, so a rename would
change the `guid` and every subscriber would receive the article again as if it
were new. The `<link>` carries the current URL; the `guid` carries identity.

Ordering by `first_published_at` rather than `current_published_at` means
republishing a post does not push it back to the top of the feed.

Both endpoints include only localizations that are publicly servable: aggregate
`editorial_state = 'active'`, localization `status = 'published'`. Withdrawn
localizations are excluded.

Both endpoints must be cached per ADR-0011. The sitemap is the heaviest query and
grows with the archive, so an uncached sitemap is the most likely place to
exhaust the Worker CPU budget described in ADR-0016.

Both endpoints must assemble their rows in a **single joined query**. D1 permits
50 queries per Worker invocation, so querying per post would fail once the feed
or sitemap exceeds that count — the platform rules out N+1 access here rather
than merely penalizing it.

Enable IndexNow through Cloudflare Crawler Hints — a zone-level toggle available
on all plans, no application code.

## Consequences

### Positive

- The sitemap reflects D1 state without a rebuild, matching the ISR-like
  publishing model of ADR-0004.
- Feed subscribers are notified once per article, regardless of slug edits.
- Republishing does not spam the feed.
- Crawl freshness is signaled without writing an IndexNow client.

### Negative

- The sitemap is application code that must be maintained, not an integration
  that maintains itself.
- Both endpoints depend on caching to stay within the free-plan CPU budget, so a
  cache misconfiguration degrades them rather than merely slowing them.
- Sitemap pagination will be needed if the archive outgrows a single document.

## Related Decisions

- [ADR-0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag.md)
- [ADR-0013](0013-define-server-first-seo-metadata-contract.md)
