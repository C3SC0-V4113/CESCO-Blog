# ADR-0037: Store structured highlight tokens and recover cache purges

- Status: Accepted
- Date: 2026-08-13

## Context

Published revisions are immutable, public rendering must not run an expensive highlighter, and D1 cannot participate in an atomic transaction with Cloudflare's global cache purge API. Workerd also rejects the default Shiki Oniguruma WebAssembly engine.

## Decision

Publishing uses Shiki's JavaScript regex engine once and stores only structured, escaped token data in the immutable revision. Draft validation never accepts those tokens, and public Astro components render token text rather than trusted HTML.

Publishing also snapshots every public inline-media field into `post_revision_media`: immutable R2 address and dimensions, canonical caption/creator/source/license metadata, plus the node alt and placement overrides. Public reads never join mutable `media_assets` for visible revision content, and the restrictive asset foreign key prevents deletion while an immutable placement references it. Source and license URLs are limited to HTTP(S) both when metadata is persisted and when historical snapshots render.

D1 commits before one exact cache-tag batch. The client supplies a stable operation UUID that becomes the revision ID. A successful D1 commit followed by purge failure returns `published-with-cache-warning`; retry recognizes that revision and purges without creating another. Unpublish and slug changes use the same truthful warning/retry outcome.

Local/test purge mode is valid only for loopback requests and records tags. Production uses a generated ignored Wrangler config whose non-secret account/D1/R2/KV/zone identifiers come from validated operator or CI environment variables. The deploy script verifies the server-only `CLOUDFLARE_CACHE_PURGE_TOKEN` exists in Wrangler's remote secret list before deploying; missing configuration fails closed.

## Consequences

- Theme changes require republishing existing revisions.
- Published code remains trust-safe without runtime highlighting or HTML injection.
- Later asset metadata edits cannot rewrite an immutable published revision.
- Cache failure is reported as post-commit recovery work, never as a database rollback.
- `/_actions/admin.*` remains inside the external Cloudflare Access boundary from ADR-0034.

## Alternatives considered

- Highlight at render time: rejected for public latency and bundle cost.
- Persist highlighted HTML: rejected because it expands the trusted-content boundary.
- Report purge failure as publish failure: rejected because D1 has already committed.
- Silently skip purge outside production: rejected because configuration mistakes would serve stale content.

## Amendment — 2026-09-10: durable purge recovery

The retry above lived only in the reviewer's browser tab. After a reload nothing recorded that pages were stale, and article HTML cached by the dashboard Cache Rule, which sets no `Cache-Control` from code, could stay stale indefinitely.

Publish, republish, unpublish and rename now insert their tag set into `pending_cache_purges` in the same D1 batch as the change, conditional on the change applying. Every purge then drains the whole backlog in requests of at most 30 tags and deletes the rows it fully covered; rows it could not purge keep an attempt count and the last error. The review queue shows a notice while rows remain, and `admin.retryPendingPurges` drains them on demand, replacing the per-tab retry actions.

The decision itself is unchanged: D1 still commits first, and a failed purge is still a warning, never a rollback.

## Related decisions

ADR-0011 defines cache tags; ADR-0024 defines strict editor content; ADR-0032 separates drafts from revisions; ADR-0034 protects admin actions.
