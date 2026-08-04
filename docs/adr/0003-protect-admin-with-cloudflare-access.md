# ADR-0003: Protect admin routes with Cloudflare Access

## Status

Accepted

## Context

The admin area is for the site owner to create drafts, review posts, manage SEO
metadata, upload media, and publish content. Building custom authentication for a
single-author admin area would add password handling, sessions, recovery flows,
and extra security surface.

## Decision

Protect private admin routes with Cloudflare Access.

Target private routes:

- `/admin` — editorial dashboard
- `/admin/posts` — post review and listing
- `/admin/posts/new` — post creation
- `/admin/posts/[id]/edit` — rich text editing
- `/admin/posts/[id]/seo` — SEO metadata management
- `/admin/media` — R2-backed media management
- `/admin/review` — draft review before publishing

Application code should still treat admin APIs as private and avoid exposing
draft data through public routes.

## Route model extension

> This route list predates
> [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md),
> which added entities it does not cover. The following surfaces are part of the
> same protected boundary. This note extends the list; the Access decision above
> is unchanged.

| Surface                                            | Entity                                                        |
| -------------------------------------------------- | ------------------------------------------------------------- |
| `/admin/collections` and `/admin/collections/[id]` | `collections`, `collection_localizations`, `collection_posts` |
| `/admin/authors`                                   | `authors`                                                     |
| Featuring controls within `/admin/posts`           | `post_localizations.featured_at`                              |
| Analysis metadata within `/admin/posts/[id]/edit`  | `post_analysis_metadata`                                      |

Changing the slug of a published localization is **not a plain update**. Per
[ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md) it must write
to `post_localization_slug_history` and rewrite existing history rows so retired
slugs resolve in a single hop. It is an admin action with rules, not a form
field, and the interface must present it as such.

The admin's rendering model is defined by
[ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md).

## Consequences

### Positive

- Avoids custom password/session implementation for the first admin version.
- Uses Cloudflare policy controls before requests reach the app.
- Keeps the app focused on editorial workflows instead of identity plumbing.

### Negative

- Admin access depends on Cloudflare Access configuration outside the repo.
- If public user accounts are needed later, app-level authentication will need a
  separate ADR.
