# ADR-0001: Adopt Cloudflare as the Astro server runtime

## Status

Accepted

## Context

Cesco Blog is moving from a starter Astro site toward a content-managed editorial
blog. The target product needs private authoring, server-side access to content,
image storage, and platform-native caching.

## Decision

Use `@astrojs/cloudflare` and Astro server output as the runtime foundation.

The first implementation phase only enables the Cloudflare adapter and server
output. It does not implement D1, R2, Cloudflare Access, cache invalidation, or
admin screens yet.

The adapter uses build-time image transformation for now. Runtime image handling
will be revisited with the R2 media implementation.

Astro's Cloudflare adapter also configures a default `SESSION` KV binding for
Astro sessions. This is platform plumbing, not the admin authentication strategy;
admin protection remains Cloudflare Access.

## Consequences

### Positive

- Aligns the app with Cloudflare Workers/Pages deployment.
- Keeps the app server-first and compatible with future D1/R2 bindings.
- Enables later route-level caching and invalidation work.

### Negative

- The app is no longer purely static by default.
- Runtime behavior must be verified against Cloudflare-compatible APIs.

## Related decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)
