# Cesco Blog

Cesco Blog is an Astro editorial blog for video game analysis, opinion, guides,
and recommendations.

## Current phase

This phase only establishes the Cloudflare runtime foundation and architecture
documentation. It does not yet implement D1, R2, Cloudflare Access, cache
invalidation, admin screens, public route pages, or a rich text editor.

## Architecture direction

| Concern            | Decision                                                    |
| ------------------ | ----------------------------------------------------------- |
| Runtime            | Astro server output on Cloudflare via `@astrojs/cloudflare` |
| Content database   | Cloudflare D1                                               |
| Media storage      | Cloudflare R2                                               |
| Admin protection   | Cloudflare Access for `/admin` and admin APIs               |
| Public performance | ISR-like behavior through Cloudflare cache and invalidation |

See [Architecture Decision Records](docs/adr/README.md) for the durable decision
log.

## Planned public routes

- `/` — editorial home with recent and featured content
- `/blog` — full post listing
- `/analisis` — video game analysis
- `/analisis/[slug]` — analysis with technical metadata and no score
- `/opiniones` — personal/editorial opinion
- `/opiniones/[slug]`
- `/guias` — guides, lists, and recommendations
- `/guias/[slug]`
- `/juegos/[slug]` — future game page with related content
- `/tags/[slug]` — topic navigation
- `/buscar` — future search

## Planned private routes

Private routes will be protected by Cloudflare Access:

- `/admin` — editorial dashboard
- `/admin/posts` — post review and listing
- `/admin/posts/new` — post creation
- `/admin/posts/[id]/edit` — rich text editing
- `/admin/posts/[id]/seo` — SEO metadata management
- `/admin/media` — R2-backed media management
- `/admin/review` — draft review before publishing

## Planned content model

### Post

- `title`, `slug`, `excerpt`, `content`
- `status`: `draft | published`
- `section`: `analysis | opinion | guide`
- `seoTitle`, `seoDescription`, `canonicalUrl`
- `coverImageKey`
- `publishedAt`, `updatedAt`

### GameMetadata

Only analysis posts have game metadata:

- `gameTitle`, `platforms`, `developer`, `publisher`, `releaseDate`, `genres`
- no numeric score

## Development

```sh
pnpm install
pnpm dev
pnpm build
```
