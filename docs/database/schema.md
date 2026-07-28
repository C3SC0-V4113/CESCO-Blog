# Database schema

Cesco Blog stores editorial content in Cloudflare D1 using Drizzle-managed SQLite
migrations. The first schema supports drafts, published revisions, SEO metadata,
game metadata for analysis posts, tags, and R2-backed media references.

## Entity relationship diagram

```mermaid
erDiagram
  POSTS {
    text id PK
    text slug UK
    text section
    text status
    text game_id FK
    text cover_media_id FK
    text published_revision_id
    text created_at
    text updated_at
    text published_at
  }

  POST_REVISIONS {
    text id PK
    text post_id FK
    integer version
    text title
    text excerpt
    json content_json
    text seo_title
    text seo_description
    text canonical_url
    text created_at
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
  POSTS ||--o{ POST_REVISIONS : "has revisions"
  POSTS ||--o{ POST_TAGS : "tagged"
  TAGS ||--o{ POST_TAGS : "used by"
  GAMES ||--o{ GAME_PLATFORMS : "released on"
  PLATFORMS ||--o{ GAME_PLATFORMS : "has games"
  GAMES ||--o{ GAME_GENRES : "classified as"
  GENRES ||--o{ GAME_GENRES : "has games"
```

## Draft and publish model

| Concept   | Rule                                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft     | A post can have many `post_revisions`; the latest draft is the highest version.                                                               |
| Publish   | `posts.published_revision_id` points to the revision currently public.                                                                        |
| Integrity | `published_revision_id` is indexed text to avoid a circular D1/Drizzle foreign key. Application code must ensure it belongs to the same post. |
| Enums     | `section` and `status` are typed in Drizzle; application code must validate allowed values before writes.                                     |
| Rich text | `post_revisions.content_json` stores structured editor JSON, not HTML.                                                                        |
| Analysis  | Analysis posts may reference one `games` row. Games never store numeric scores.                                                               |
| Media     | `media_assets.r2_key` stores the future R2 object key; uploads are not implemented in this slice.                                             |

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
