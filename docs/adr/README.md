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

| [0019](0019-render-astro-first-with-react-islands-for-behavior.md) | Render Astro-first and reserve React islands for behavior | Accepted | 2026-08-03 |
| [0020](0020-extend-shadcn-with-base-ui-compatible-registries.md) | Extend shadcn with Base UI–compatible registries | Accepted | 2026-08-03 |
| [0021](0021-define-editorial-typography-and-component-boundaries.md) | Define editorial typography and component ownership boundaries | Accepted | 2026-08-03 |
| [0022](0022-adopt-css-only-motion-with-shared-easing-scale.md) | Adopt CSS-only motion with a shared easing scale | Accepted | 2026-08-03 |

| [0023](0023-treat-the-admin-as-a-client-rendered-application.md) | Treat the admin as a client-rendered application | Accepted | 2026-08-03 |
| [0024](0024-adopt-tiptap-for-the-editorial-content-pipeline.md) | Adopt Tiptap for the editorial content pipeline | Accepted | 2026-08-03 |

| [0025](0025-test-d1-through-the-workers-vitest-pool.md) | Test D1 through the Workers Vitest pool | Accepted | 2026-08-04 |
| [0026](0026-generate-identifiers-with-crypto-randomuuid.md) | Generate identifiers with crypto.randomUUID() | Accepted | 2026-08-04 |
| [0027](0027-localize-ui-strings-with-a-typed-dictionary.md) | Localize UI strings with a typed dictionary | Accepted | 2026-08-04 |
| [0028](0028-normalize-and-validate-media-uploads-before-storage.md) | Normalize and validate media uploads before storage | Accepted | 2026-08-04 |
| [0029](0029-store-timestamps-in-sqlite-current-timestamp-format.md) | Store timestamps in SQLite's CURRENT_TIMESTAMP format | Accepted | 2026-08-04 |
| [0030](0030-style-components-with-tailwind-utilities.md) | Style components with Tailwind utilities | Accepted | 2026-08-05 |
| [0031](0031-layer-the-data-path-by-effect-and-testability.md) | Layer the data path by effect and testability | Accepted | 2026-08-05 |
| [0032](0032-separate-drafts-from-revisions.md) | Separate drafts from revisions | Accepted | 2026-08-07 |
| [0033](0033-serve-media-from-r2-through-the-worker.md) | Serve media from R2 through the Worker | Accepted | 2026-08-07 |

## Status values

- **Accepted**: decision is approved for implementation.
- **Superseded**: decision was replaced by a newer ADR.
- **Deprecated**: decision is no longer recommended, but may still exist in code.
- **Rejected**: decision was considered and intentionally not adopted.
