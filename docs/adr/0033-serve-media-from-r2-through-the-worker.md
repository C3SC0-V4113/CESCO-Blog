# ADR-0033: Serve media from R2 through the Worker

## Status

Accepted

## Date

2026-08-07

## Context

Nothing serves stored media. ADR-0006 models it, ADR-0028 decides how it is
validated and keyed on the way in, and neither says how a browser gets it back
out. The gap was invisible while nothing rendered an image, and
`article-body.astro` throws on an `image` node for exactly this reason.

It stops being invisible at the social card. ADR-0015 has a generator write a
card to R2 and set `og_image_media_id`, and `og:image` is an absolute URL that a
platform fetches from outside. Without delivery, that pipeline ends in a `404`
served to every social crawler — the feature would be complete and useless.

The same missing route blocks the editorial cover ADR-0015 requires at publish,
and the inline images ADR-0024 places by `block_id`. One decision unblocks three
consumers.

## Decision

Serve media from a Worker route at **`/media/...`**, keyed by the stored R2 key.

**The key is the address.** A request for `/media/2026/08/{id}.png` reads exactly
that key from the bucket. No database query participates in delivery, which
matters because images are the highest-volume request on a page and ADR-0016
budgets 50 queries per invocation for everything else.

Exposing the key is safe by construction rather than by obscurity: ADR-0028
derives it once as `media/{yyyy}/{mm}/{mediaAssetId}.{ext}` from an identifier
that is not a secret, and never rewrites it.

**Cached for a year, `immutable`.** Also a consequence of that convention: a key
names one byte sequence for as long as it exists, so replacing an image means a
new asset, a new key and a new URL. The response carries `Cache-Tag:
media-{id}`, with the id read back out of the key rather than looked up, so
deleting an asset can purge it (ADR-0011).

**Content type is checked against an allow-list at serving time**, not passed
through from storage. ADR-0028 rejects SVG at upload because, served from our own
origin, it is an XSS vector. That check protects against what arrives; this one
protects against what is already in the bucket — an object written before the
rule existed, or by a path that bypassed it. `X-Content-Type-Options: nosniff`
closes the remaining half, since a browser that sniffs can reach its own
conclusion about a file regardless of the header.

A stored object whose type is not on the list answers **`404`, not `415`**.
Whether a file exists at a key is not something an unauthenticated caller needs
to learn.

**A miss is a `404` cached for 60 seconds.** A card referenced by a revision
published seconds before its upload finished is a race rather than a fact, and a
long-lived cached miss outlives the upload by the length of the cache.

**`If-None-Match` is answered here** rather than left to the platform, because
the saving is a whole object read on every repeat request.

## Consequences

### Positive

- The card generator, the editorial cover and inline article images all become
  possible; `article-body.astro` can stop throwing.
- Delivery costs zero D1 queries and no image processing — ADR-0028 already
  normalized the bytes, so the Worker only streams them.
- Cache tags make media purgeable through the same mechanism as every other
  surface, rather than needing a second invalidation story.

### Negative

- Media is served through the Worker, so every image is an invocation. Free-plan
  request counts now scale with images per page, not only with pages.
- A public bucket domain would have cost nothing per request. That option was
  rejected because it gives up cache headers, cache tags and the serving-time
  allow-list — the three things that make this route worth having.

### Risks

- The allow-list is a second copy of a decision ADR-0028 already made, and two
  copies can drift. It is deliberate duplication, but if the list grows it
  belongs in one shared module rather than two.

## Related decisions

- [ADR-0028](0028-normalize-and-validate-media-uploads-before-storage.md) — the
  key convention this route depends on, and the upload-side allow-list.
- [ADR-0015](0015-separate-social-card-from-editorial-cover-image.md) — the
  consumer that made the gap urgent.
- [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag.md) — how a served
  object is purged.
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md) — the query budget
  delivery deliberately spends nothing from.
