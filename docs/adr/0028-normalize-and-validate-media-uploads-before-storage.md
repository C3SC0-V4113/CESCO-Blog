# ADR-0028: Normalize and validate media uploads before storage

## Status

Accepted

## Date

2026-08-04

## Context

ADR-0024 settled how an uploaded image reaches R2 and how the resulting
`media_assets` row is linked to the editor document. It did not settle what
arrives, or what happens to it on the way.

Two gaps followed from that. Uploaded images were stored at whatever size the
author's screenshot happened to be, and the article cover is the LCP element of
the article page — the metric `DESIGN.md` names as its performance reference. And
nothing validated the file at all: Cloudflare Access protects the route, but an
authenticated user is not the same as a safe file.

Server-side processing is not available. Workers cannot run `sharp`, and image
resizing is precisely the kind of compute the ~10 ms CPU budget of ADR-0016 does
not tolerate. Cloudflare Images was already rejected on cost.

## Decision

**Normalize in the browser before uploading.** The admin is a client-rendered
React application (ADR-0023), so it can use `createImageBitmap` and a canvas to
downscale to a maximum width and convert to WebP before the request is sent.

That costs zero Worker CPU, requires no paid product, and uploads fewer bytes
than the original. The real post-resize dimensions are recorded in
`media_assets.width` / `height` so ADR-0013 can emit them and avoid layout shift.

**Validation**, none of which existed before:

| Rule                                                                              | Reason                                                                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Allow-list by inspected content, not by file extension or declared `Content-Type` | Both are attacker-controlled and trivially wrong                                                                        |
| **SVG is rejected**                                                               | Served from the site's own origin it is an XSS vector; Access authenticates the uploader, it does not sanitize the file |
| Maximum size enforced after client-side resize, and again on the server           | The client is a convenience, not a control                                                                              |
| Dimensions read from the decoded image, not from client-supplied values           | Wrong dimensions reintroduce the layout shift they were meant to prevent                                                |

Client-side checks are for feedback. The endpoint repeats every one of them,
because anything the browser enforces can be bypassed by not using the browser.

**`r2_key` convention.** Keys are `media/{yyyy}/{mm}/{mediaAssetId}.{ext}`. The
identifier makes the key unique without a lookup, and the date prefix keeps
listings browsable. The key is derived once at creation and never rewritten:
`media_assets.r2_key` is unique, and rewriting it would orphan the stored object.

## Consequences

### Positive

- The LCP image is right-sized before it is ever stored, so no serving-time
  transformation is needed.
- No Worker CPU is spent on images, and no paid image product is required.
- The upload path has an actual threat model instead of trusting the session.
- Object keys are unique by construction and readable when browsing the bucket.

### Negative

- Normalization depends on browser APIs, so a client without canvas support
  cannot upload — acceptable for a single-author admin, unacceptable if the
  admin ever opens up.
- Re-encoding to WebP is lossy; the original is not retained, so a later change
  of target format or size cannot be applied to existing assets.
- Validation is duplicated on client and server, and the two can drift.
- Rejecting SVG rules out uploading diagrams and logos as vectors; they must be
  rasterized first.

## Related Decisions

- [ADR-0013](0013-define-server-first-seo-metadata-contract.md)
- [ADR-0015](0015-separate-social-card-from-editorial-cover-image.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
- [ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md)
- [ADR-0024](0024-adopt-tiptap-for-the-editorial-content-pipeline.md)
