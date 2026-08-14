# ADR-0036: Bound media normalization and storage

## Status

Accepted

## Date

2026-08-13

## Context

ADR-0028 correctly chose browser normalization, but its statement that the Worker
could repeat decoded-pixel validation is infeasible without an image decoder. It
also left request bounds, persistence order, and accessibility metadata implicit.

## Decision

The browser decodes one PNG, JPEG, or WebP, rejects sources over 25 MiB or 40 MP,
and uses canvas to produce WebP at quality 0.82, at most 2400 pixels wide without
upscaling. Normalized output must be at most 5 MiB.

`POST /admin/media/upload` is inside the Cloudflare Access `/admin/*` boundary. It
also requires a matching Origin and a custom upload marker, incrementally reads at
most 5 MiB, and structurally validates one static RIFF/WEBP image payload plus VP8,
VP8L, or VP8X dimensions. Animated, multi-image, and mismatched-canvas containers
are rejected because canvas normalization produces one static image.
This supersedes only ADR-0028's infeasible claim that the Worker decodes pixels.

The Worker creates an immutable `media/{UTC yyyy}/{UTC mm}/{UUID}.webp` object in
R2, then inserts its inspected type, size, and dimensions in D1. A failed D1 write
is compensated by awaiting R2 deletion. Canonical alt text is required unless the
author explicitly marks the image decorative; an empty stored alt represents that
choice. Editor JSON stores only `{blockId, mediaAssetId, alt}`. Revision placement
rows remain publish-time work.

## Alternatives

- Worker pixel decoding was rejected because the selected runtime has no decoder.
- Cloudflare Images or a dedicated image service was rejected for this single-user
  product's cost and operational overhead.
- Storing originals was rejected because it increases storage and leaves public
  rendering responsible for normalization.

## Consequences

Validation is intentionally duplicated, but the server proves structure and bounds,
not decoded pixels. Access enforcement remains external configuration. An R2/D1
transaction is unavailable, so explicit ordered compensation is required.

## Related Decisions

- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0024](0024-adopt-tiptap-for-the-editorial-content-pipeline.md)
- [ADR-0028](0028-normalize-and-validate-media-uploads-before-storage.md)
- [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md)
- [ADR-0033](0033-serve-media-from-r2-through-the-worker.md)
