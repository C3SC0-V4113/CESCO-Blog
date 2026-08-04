# ADR-0011: Invalidate Cloudflare cache by cache tag on editorial events

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0004 chose Cloudflare caching for ISR-like publishing and named cache tags as
the preferred invalidation model, deferring implementation to a later phase.

Cache tags were historically an Enterprise-only feature, which would have ruled
them out for this project. That is no longer true: on 2025-04-01 Cloudflare made
every purge method — by URL, hostname, tag, prefix, and purge everything —
available on all plans, including Free. Plans now differ in purge rate limits
rather than in available methods.

The invalidation surface has also grown since ADR-0004 was written. ADR-0010
introduces `301` redirects and `410` responses, and ADR-0014 adds RSS and sitemap
endpoints — all cacheable responses that go stale on editorial events.

The hardest case to handle by URL enumeration is cross-locale: publishing the
English localization changes the Spanish page's `hreflang`, so the Spanish URL
must be invalidated by an event that never mentions it. Enumerating URLs means
every new listing surface is another entry someone has to remember to add, and
forgetting one produces stale pages with no error.

## Decision

Invalidate by **cache tag**. Responses carry a `Cache-Tag` header describing what
they depend on; editorial events purge by tag through the Cloudflare API.

Tag responses by dependency, not by URL:

| Response                     | Tags                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| Post detail                  | `post-{postId}`, `locale-{locale}`, `section-{section}`         |
| Section listing              | `section-{section}`, `locale-{locale}`                          |
| Home                         | `locale-{locale}`, `featured`                                   |
| Tag / game / collection page | `tag-{id}` / `game-{id}` / `collection-{id}`, `locale-{locale}` |
| RSS                          | `rss`, `locale-{locale}`                                        |
| Sitemap                      | `sitemap`                                                       |

Tagging by `post-{postId}` — the locale-neutral aggregate ID, not the
localization ID — makes the cross-locale case fall out for free. Both the Spanish
and English detail pages carry the same `post-{postId}` tag, so publishing either
locale purges both and the `hreflang` on the already-published side refreshes
without anyone enumerating it.

Publishing, unpublishing, archiving, reactivating, and renaming a slug all purge
the affected `post-{postId}`, the relevant `section-`, `locale-`, `rss`, and
`sitemap` tags.

Serve `301` and `410` responses with a short TTL in addition to tagging them. A
long-lived cached `410` survives republication and leaves a URL dead until manual
purge.

The Workers Cache API (`caches.default.delete()`) only affects the data center
executing the Worker. It is not a substitute for zone purge.

Free-plan purge rate limits are 5 requests per minute with a 25-token bucket.
A personal publishing cadence does not approach this, but bulk operations —
re-tagging the archive, a scripted backfill — must batch tags per call rather
than issuing one call per URL.

Verify at implementation time that `Cache-Tag` headers set by a Worker response
are honored by the zone cache, and check the per-response tag count and header
size limits. This ADR settles the mechanism, not the header plumbing.

This ADR confirms and concretes the invalidation strategy of ADR-0004 rather than
replacing it.

## Consequences

### Positive

- The cross-locale invalidation case is structural rather than a rule someone has
  to remember.
- Adding a listing surface means tagging it, not editing a central URL map.
- Purge calls stay small and constant regardless of how large the archive grows.
- Short TTLs on `301`/`410` keep withdrawal reversible.

### Negative

- Every cached response must set correct tags at render time; an untagged
  response is never invalidated and goes stale silently.
- Tag vocabulary becomes an interface that rendering and publishing must agree
  on, and drift between them is not detectable by types.
- Purge requires a Cloudflare API token held as a secret by whatever performs the
  publish.
- Free-plan purge rate limits constrain bulk re-tagging operations.

## Related Decisions

- [ADR-0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
