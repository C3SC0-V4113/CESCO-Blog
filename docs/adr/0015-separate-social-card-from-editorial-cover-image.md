# ADR-0015: Separate the social card image from the editorial cover image

## Status

Accepted

## Date

2026-08-03

## Context

Social platforms render a link preview from `og:image` plus `og:title` and
`og:description`, which they display as their own text outside the image. Cards
that burn the article title into the image read well in a feed, which is why the
pattern is widespread.

Google Discover and rich results work differently. They select the article's main
image, guided by the `image` field of the structured data, and deprioritize
images dominated by text overlays because they resemble promotional banners.

These two consumers want opposite things from the same slot. Generating the card
at request time is also not viable: Satori and resvg are CPU-heavy and the free
Workers plan enforces a tight per-invocation CPU budget (ADR-0016), while
Cloudflare Images is a paid product.

## Decision

Treat the social card and the editorial image as two distinct assets. The schema
already separates them.

| Asset           | Column                             | Content                             | Consumers                               |
| --------------- | ---------------------------------- | ----------------------------------- | --------------------------------------- |
| Social card     | `post_revisions.og_image_media_id` | Composed image with burned-in title | `og:image`, `twitter:image`             |
| Editorial image | `posts.cover_media_id`             | Clean photo or screenshot, no text  | JSON-LD `image`, in-page hero, Discover |

The social card resolves through: `og_image_media_id`, then
`posts.cover_media_id`, then a static fallback.

Publishing requires `posts.cover_media_id`. Requiring merely "one of the two"
would allow a post with a generated card but no editorial image, which publishes
cleanly while emitting `BlogPosting` structured data with no `image` at all — the
signal ADR-0013 identifies as the one that matters for Discover. The cover is the
editorial requirement; the card is an enhancement layered on top of it.

With the cover guaranteed, the static fallback is only reached when a media asset
is deleted out from under a published revision, rather than being a routine path.
A single shared fallback across many posts is exactly the generic image Discover
discards.

Card composition is **title, brand or author, and section**. The description is
not burned in: platforms already render `og:description` as their own text
beside the image, so burning it duplicates the text and is unreadable at feed
size.

Because the card carries localized title text, there is one card per
localization. `og_image_media_id` lives on `post_revisions`, which is per
localization, so the generator iterates over localizations rather than posts.

Emit `og:image:width` and `og:image:height` from `media_assets.width` and
`media_assets.height`. Without them some platforms fetch the image before
choosing a layout and fall back to a small card.

Generate cards with a Node script in `scripts/`, run locally, never in the
Worker. It shares `src/db/schema.ts` with the application so `media_assets`
types cannot drift. The script writes the object to R2, inserts the
`media_assets` row, and sets `og_image_media_id` on the revision.

Satori does not support WOFF2 or variable fonts. The current dependencies
(`@fontsource-variable/figtree`, `@fontsource-variable/merriweather`) ship
variable WOFF2, so the generator needs static `.ttf` builds of the same
typefaces.

## Consequences

### Positive

- Google receives a clean editorial image and social platforms receive a
  designed card, with no compromise between them.
- Card generation costs nothing: local CPU, R2 free-tier storage, zero egress.
- The Worker never runs image composition, so the CPU budget is unaffected.
- Publish-time validation keeps the generic fallback rare.

### Negative

- Publishing has a local step that is not part of the application until the
  admin exists.
- Two cards per post instead of one, doubling generation work and R2 objects.
- The static font requirement adds dependencies that duplicate typefaces already
  installed in variable form.
- The resolution chain has three levels, and the wrong one silently produces a
  worse preview rather than an error.

## Related Decisions

- [ADR-0006](0006-model-editorial-media-and-social-preview-images.md)
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0013](0013-define-server-first-seo-metadata-contract.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
- [ADR-0017](0017-bootstrap-content-with-seed-script.md)
