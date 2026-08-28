# ADR-0038: Keep retired post slugs append-only

- Status: Accepted
- Date: 2026-08-13
- Supersedes in part: ADR-0003 and ADR-0010

## Context

ADR-0010 correctly requires permanent retired-slug reservation and one-hop redirects, but it describes rewriting earlier history rows after each rename. ADR-0003 repeats that mechanic when classifying the rename as an admin action. The implemented history row references a localization, not another slug, so rewriting history is unnecessary and would weaken its audit trail.

## Decision

`post_localization_slug_history` is append-only. When an ever-published localization changes from A to B, the transaction inserts A as a retired slug and updates the localization's current slug to B. A later B-to-C change inserts B; public resolution joins either history row to the localization and redirects directly to C.

The transaction decides whether the localization was ever published from `first_published_at`; a never-published rename creates no history. Live and retired slugs remain permanently reserved per locale.

This ADR supersedes **only** the mutable/rewrite history mechanics in ADR-0010 and the matching sentence in ADR-0003. Their unrelated decisions remain accepted, including Cloudflare Access protection, 404/410 behavior, immutable publication timestamps, permanent reservation, and the one-hop redirect outcome. Collection slug constraints are also unchanged.

## Consequences

- Retired URLs resolve in one hop without mutating historical evidence.
- A-to-B-to-C produces two immutable history rows that both resolve through the localization's current slug.
- Rename, reservation checks, conditional history insertion, and the current-slug update must remain atomic.

## Related decisions

- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md)
