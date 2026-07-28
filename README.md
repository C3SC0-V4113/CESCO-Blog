# Cesco Blog

Cesco Blog is an Astro editorial blog for video game analysis, opinion, guides,
and recommendations.

## Current phase

This phase establishes the Cloudflare runtime foundation and the first D1
database foundation. It includes Drizzle schema/migrations, Wrangler D1 binding,
local D1 migration workflow, and database documentation. It does not yet
implement R2 uploads, Cloudflare Access policies, cache invalidation, admin
screens, public route pages, or a rich text editor.

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

## Database and Cloudflare local development

The content database is Cloudflare D1, with schema and migrations managed by
Drizzle.

```sh
pnpm run db:generate
pnpm run db:migrate:local
pnpm run cf:types
pnpm run dev:cf
```

`pnpm run dev:cf` runs the Astro app through Wrangler so local development uses
Cloudflare-style bindings. Use `pnpm dev` when Cloudflare bindings are not
needed. Remote D1 deploys require replacing the placeholder `database_id` in
`wrangler.jsonc` with the real D1 database ID. Remote deploys also need real
Cloudflare resource IDs for explicitly configured bindings such as the Astro
`SESSION` KV namespace.

See [Database schema](docs/database/schema.md) for the Mermaid ER diagram and
relationship notes.
