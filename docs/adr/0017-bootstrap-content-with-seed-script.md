# ADR-0017: Bootstrap content with a seed script and defer the admin

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0003 specifies an admin area behind Cloudflare Access, covering draft
creation, rich-text editing, SEO metadata, media, and review. None of it is
built.

Public rendering cannot be developed or verified against an empty database, and
building the full admin first would delay the public site behind an editing
tool nobody but the owner will ever use.

ADR-0012 also introduces derived fields on `post_revisions` that are computed at
publish time. Whatever writes content must compute them, or the first real posts
will have a null table of contents and no reading time.

## Decision

Load initial content with a seed script in `scripts/`, run locally against D1.
The admin remains planned but does not block the first public render.

The seed script computes `reading_time_minutes` and `toc_json` using a **shared
module**, not its own copy of the logic. The future admin imports the same
module. Duplicating it guarantees the two paths diverge and produce revisions
with inconsistent derived data.

The script lives beside the Open Graph generator from ADR-0015, sharing
`src/db/schema.ts` so types cannot drift from the application.

Record the explicit debt: until the admin exists, publishing requires running a
local script with database access, and there is no review step, no draft preview,
and no audit trail beyond the revision history the schema already keeps.

## Consequences

### Positive

- Public rendering can be built and tested against real content immediately.
- The derived-field logic is exercised and settled before the admin is written.
- The admin can be designed against a schema already proven by real writes.

### Negative

- Publishing is a developer operation, not an editorial one, for as long as this
  holds.
- The seed script needs database credentials on a local machine.
- Content written this way bypasses any validation the admin would eventually
  enforce, including the Open Graph requirement from ADR-0015.

## Related Decisions

- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0015](0015-separate-social-card-from-editorial-cover-image.md)
