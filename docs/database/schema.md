# Database schema

Cesco Blog stores editorial content in Cloudflare D1 using Drizzle-managed SQLite
migrations. The schema supports locale-neutral editorial posts, per-locale
drafts and published revisions, localized SEO metadata, localized Open
Graph/social preview metadata, game metadata for analysis posts, tags, and
R2-backed media references.

## Entity relationship diagram

```mermaid
erDiagram
  POSTS {
    text id PK
    text section
    text editorial_state
    text game_id FK
    text cover_media_id FK
    text created_at
    text updated_at
  }

  POST_LOCALIZATIONS {
    text id PK
    text post_id FK
    text locale
    text slug
    text status
    text published_revision_id
    text published_at
    text created_at
    text updated_at
  }

  POST_REVISIONS {
    text id PK
    text post_localization_id FK
    integer version
    text title
    text excerpt
    json content_json
    text seo_title
    text seo_description
    text canonical_url
    text og_title
    text og_description
    text og_image_media_id FK
    text og_image_alt
    text created_at
  }

  POST_REVISION_MEDIA {
    text revision_id PK FK
    text media_asset_id PK FK
    text block_id PK
    integer position UK
    text alt_text
    text caption
    text credit_override
  }

  GAMES {
    text id PK
    text slug UK
    text title
    text developer
    text publisher
    text release_date
  }

  MEDIA_ASSETS {
    text id PK
    text r2_key UK
    text alt_text
    text caption
    text description
    integer is_own_work
    text creator_name
    text source_url
    text license_label
    text license_url
    text content_type
    integer width
    integer height
    integer size_bytes
  }

  TAGS {
    text id PK
    text slug UK
    text name UK
  }

  POST_TAGS {
    text post_id FK
    text tag_id FK
  }

  PLATFORMS {
    text id PK
    text slug UK
    text name UK
  }

  GAME_PLATFORMS {
    text game_id FK
    text platform_id FK
  }

  GENRES {
    text id PK
    text slug UK
    text name UK
  }

  GAME_GENRES {
    text game_id FK
    text genre_id FK
  }

  GAMES ||--o{ POSTS : "analysis content"
  MEDIA_ASSETS ||--o{ POSTS : "cover image"
  POSTS ||--o{ POST_LOCALIZATIONS : "translated as"
  POST_LOCALIZATIONS ||--o{ POST_REVISIONS : "has localized revisions"
  POST_REVISIONS ||--o{ POST_REVISION_MEDIA : "uses inline media"
  MEDIA_ASSETS ||--o{ POST_REVISION_MEDIA : "embedded in revisions"
  MEDIA_ASSETS |o--o{ POST_REVISIONS : "optional social preview image"
  POSTS ||--o{ POST_TAGS : "tagged"
  TAGS ||--o{ POST_TAGS : "used by"
  GAMES ||--o{ GAME_PLATFORMS : "released on"
  PLATFORMS ||--o{ GAME_PLATFORMS : "has games"
  GAMES ||--o{ GAME_GENRES : "classified as"
  GENRES ||--o{ GAME_GENRES : "has games"
```

## Draft and publish model

| Concept              | Rule                                                                                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post aggregate       | `posts` is locale-neutral and stores shared editorial state, section, game metadata link, and cover media. `posts.editorial_state` is the aggregate-level hide/archive switch across all localizations.                                                                                      |
| Localization         | `post_localizations` stores one row per `(post_id, locale)` with localized slug, lifecycle status, published pointer, and publish timestamp. Supported locales are `es` and `en`.                                                                                                            |
| Draft                | A localization can have many `post_revisions`; the latest draft for a language is the highest version for that localization.                                                                                                                                                                 |
| Publish              | `post_localizations.published_revision_id` points to the revision currently public for that language, so Spanish and English can publish independently.                                                                                                                                      |
| Integrity            | `published_revision_id` is indexed text to avoid a circular D1/Drizzle foreign key. Application code must ensure it belongs to the same localization.                                                                                                                                        |
| Slugs                | `(locale, slug)` is unique so `/es/...` and `/en/...` can use language-specific slugs without colliding across languages.                                                                                                                                                                    |
| Enums                | `section`, post aggregate `editorial_state`, localization `status`, and `locale` are typed in Drizzle; application code must validate allowed values before writes. Current section values are `analysis` and `opinion`; post editorial states are `active` and `archived`.                  |
| Rich text            | `post_revisions.content_json` stores structured editor JSON, not HTML, scoped to a localization.                                                                                                                                                                                             |
| Localized SEO/OG     | `post_revisions` stores title, excerpt, canonical URL, SEO fields, and Open Graph/social fields per localization revision.                                                                                                                                                                   |
| Analysis             | Analysis posts may reference one `games` row. Games never store numeric scores.                                                                                                                                                                                                              |
| Media                | `media_assets.r2_key` stores the future R2 object key; uploads are not implemented in this slice. `alt_text` remains the canonical accessibility and SEO alt text for the asset.                                                                                                             |
| Attribution          | `media_assets` stores reusable attribution fields: description, own-work flag, creator, source URL, license label, and license URL. Inline placements may override displayed credit with `post_revision_media.credit_override`.                                                              |
| Inline media         | `post_revision_media` maps editor block IDs to media assets per revision. It cascades with the revision and asset, stores per-placement alt text/caption overrides, uses `(revision_id, block_id, media_asset_id)` as its primary key, and keeps `(revision_id, block_id, position)` unique. |
| Social preview image | `post_revisions.og_image_media_id` references `media_assets` and is set to null if the asset is removed.                                                                                                                                                                                     |
| Public visibility    | Public post queries must require `posts.editorial_state = 'active'` and `post_localizations.status = 'published'`. The post aggregate can hide all localized versions while each localization keeps its own publication lifecycle.                                                           |

## Local workflow

```sh
pnpm run db:generate
pnpm run db:migrate:local
pnpm run cf:types
pnpm run dev:cf
```

Remote migrations require replacing the placeholder D1 database ID in
`wrangler.jsonc` with the real Cloudflare database ID. Remote deploys also need
real Cloudflare resource IDs for any explicitly configured bindings.
