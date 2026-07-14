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

## Consequences

### Positive

- Avoids custom password/session implementation for the first admin version.
- Uses Cloudflare policy controls before requests reach the app.
- Keeps the app focused on editorial workflows instead of identity plumbing.

### Negative

- Admin access depends on Cloudflare Access configuration outside the repo.
- If public user accounts are needed later, app-level authentication will need a
  separate ADR.
