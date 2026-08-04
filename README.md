# Cesco Blog

Cesco Blog is an Astro editorial blog focused on video game analysis, with
opinion as a secondary section.

## Current phase

This phase establishes the Cloudflare runtime foundation and the first D1
database foundation. It includes Drizzle schema/migrations, Wrangler D1 binding,
local D1 migration workflow, and database documentation. It does not yet
implement R2 uploads, Cloudflare Access policies, cache invalidation, admin
screens, public content route pages, or a rich text editor. The only public
pages currently present are temporary localized home placeholders required to
support Astro i18n routing.

## Architecture direction

| Concern            | Decision                                                    |
| ------------------ | ----------------------------------------------------------- |
| Runtime            | Astro server output on Cloudflare via `@astrojs/cloudflare` |
| Content database   | Cloudflare D1                                               |
| Media storage      | Cloudflare R2                                               |
| Admin protection   | Cloudflare Access for `/admin` and admin APIs               |
| Public performance | ISR-like behavior through Cloudflare cache and invalidation |

See [Architecture Decision Records](docs/adr/README.md) for the durable decision
log, and [DESIGN.md](DESIGN.md) for the living reference of the interface: design
tokens, typography, the component inventory, and the motion rules.

## Planned public routes

Public routes are localized with explicit `/es` and `/en` prefixes. Spanish is
the default locale, but default-locale URLs are still prefixed for SEO clarity.

- `/es` and `/en` — editorial home with recent and featured content
- `/es/blog` and `/en/blog` — full post listing
- `/es/analisis` and `/en/analysis` — video game analysis
- `/es/analisis/[slug]` and `/en/analysis/[slug]` — analysis with technical
  metadata and no score
- `/es/opiniones` and `/en/opinions` — personal/editorial opinion
- `/es/opiniones/[slug]` and `/en/opinions/[slug]`
- `/es/juegos/[slug]` and `/en/games/[slug]` — future game page with related
  content
- `/es/etiquetas/[slug]` and `/en/tags/[slug]` — topic navigation
- `/es/buscar` and `/en/search` — future search

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

- `Post`: shared aggregate with `section`, `editorialState`, `gameId`, and `coverMediaId`
- `Post.editorialState`: `active | archived`
- `PostLocalization`: per-locale `locale`, `slug`, localized `status`,
  `publishedRevisionId`, and `publishedAt`
- `PostLocalization.status`: `draft | published | archived`
- admin can archive the post aggregate to hide all localizations at once, while
  localization status still controls each language publication lifecycle
- per-locale revisions: `title`, `excerpt`, `content`
- `section`: `analysis | opinion`
- language-specific `seoTitle`, `seoDescription`, `canonicalUrl`
- language-specific `ogTitle`, `ogDescription`, `ogImageMediaId`, `ogImageAlt`
- inline image placements in rich-text content
- `createdAt`, `updatedAt`

### MediaAsset

Media assets are R2-backed records that can be reused as cover images, inline
rich-text images, and Open Graph/social preview images. `altText` is the
canonical accessibility and SEO alt text. Attribution fields track description,
own-work status, creator, source URL, license label, and license URL, with
per-placement overrides available for inline post revision media.

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
