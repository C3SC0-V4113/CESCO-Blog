# Architecture Decision Records

This directory records durable architecture decisions for Cesco Blog.

## Index

| ADR                                                                     | Title                                                                           | Status   | Date       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-adopt-cloudflare-runtime.md)                                | Adopt Cloudflare as the Astro server runtime                                    | Accepted | 2026-07-13 |
| [0002](0002-use-d1-for-content-storage.md)                              | Use D1 for content storage                                                      | Accepted | 2026-07-13 |
| [0003](0003-protect-admin-with-cloudflare-access.md)                    | Protect admin routes with Cloudflare Access                                     | Accepted | 2026-07-13 |
| [0004](0004-use-cloudflare-cache-for-isr-like-publishing.md)            | Use Cloudflare cache for ISR-like publishing                                    | Accepted | 2026-07-13 |
| [0005](0005-use-drizzle-for-d1-schema-and-migrations.md)                | Use Drizzle for D1 schema and migrations                                        | Accepted | 2026-07-18 |
| [0006](0006-model-editorial-media-and-social-preview-images.md)         | Model editorial media and social preview images                                 | Accepted | 2026-07-28 |
| [0007](0007-narrow-editorial-sections-to-analysis-and-opinion.md)       | Narrow editorial sections to analysis and opinion                               | Accepted | 2026-08-03 |
| [0008](0008-adopt-bilingual-localized-publishing.md)                    | Adopt bilingual localized publishing                                            | Accepted | 2026-08-03 |
| [0009](0009-use-post-editorial-state-for-global-archive.md)             | Use post editorial state for global archive                                     | Accepted | 2026-08-03 |
| [0010](0010-define-public-url-lifecycle-for-localized-posts.md)         | Define public URL lifecycle for localized posts                                 | Accepted | 2026-08-03 |
| [0011](0011-invalidate-cloudflare-cache-by-cache-tag.md)                | Invalidate Cloudflare cache by cache tag on editorial events                    | Accepted | 2026-08-03 |
| [0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md) | Extend the editorial schema for authors, series, and analysis metadata          | Accepted | 2026-08-03 |
| [0013](0013-define-server-first-seo-metadata-contract.md)               | Define the server-first SEO metadata contract                                   | Accepted | 2026-08-03 |
| [0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)              | Serve RSS and sitemap as dynamic endpoints from D1                              | Accepted | 2026-08-03 |
| [0015](0015-separate-social-card-from-editorial-cover-image.md)         | Separate the social card image from the editorial cover image                   | Accepted | 2026-08-03 |
| [0016](0016-host-blog-on-checkpoint-subdomain.md)                       | Host the blog on checkpoint.cescovalle.com with Cloudflare DNS alongside Vercel | Accepted | 2026-08-03 |
| [0017](0017-bootstrap-content-with-seed-script.md)                      | Bootstrap content with a seed script and defer the admin                        | Accepted | 2026-08-03 |
| [0018](0018-adopt-privacy-first-analytics-and-defer-monetization.md)    | Adopt privacy-first analytics, transparency pages, and defer monetization       | Accepted | 2026-08-03 |

## Status values

- **Accepted**: decision is approved for implementation.
- **Superseded**: decision was replaced by a newer ADR.
- **Deprecated**: decision is no longer recommended, but may still exist in code.
- **Rejected**: decision was considered and intentionally not adopted.
