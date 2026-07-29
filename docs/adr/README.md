# Architecture Decision Records

This directory records durable architecture decisions for Cesco Blog.

## Index

| ADR                                                             | Title                                           | Status   | Date       |
| --------------------------------------------------------------- | ----------------------------------------------- | -------- | ---------- |
| [0001](0001-adopt-cloudflare-runtime.md)                        | Adopt Cloudflare as the Astro server runtime    | Accepted | 2026-07-13 |
| [0002](0002-use-d1-for-content-storage.md)                      | Use D1 for content storage                      | Accepted | 2026-07-13 |
| [0003](0003-protect-admin-with-cloudflare-access.md)            | Protect admin routes with Cloudflare Access     | Accepted | 2026-07-13 |
| [0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)    | Use Cloudflare cache for ISR-like publishing    | Accepted | 2026-07-13 |
| [0005](0005-use-drizzle-for-d1-schema-and-migrations.md)        | Use Drizzle for D1 schema and migrations        | Accepted | 2026-07-18 |
| [0006](0006-model-editorial-media-and-social-preview-images.md) | Model editorial media and social preview images | Accepted | 2026-07-28 |

## Status values

- **Accepted**: decision is approved for implementation.
- **Superseded**: decision was replaced by a newer ADR.
- **Deprecated**: decision is no longer recommended, but may still exist in code.
- **Rejected**: decision was considered and intentionally not adopted.
