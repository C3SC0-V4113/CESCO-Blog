# ADR-0035: Coordinate draft autosave with compare-and-swap

**Status:** Accepted — 2026-08-13

## Context

ADR-0032 establishes one mutable draft per localization, but concurrent tabs can
silently overwrite each other and overlapping autosaves can arrive out of order.

## Decision

The editor saves after one second of inactivity. Requests are serialized; edits
made during a request coalesce into the next save. An explicit flush is available,
and navigation warns while work is dirty, saving, failed, or conflicted.

Each draft carries an opaque `draft_token`. Updates compare the last token and
replace it atomically. A mismatch preserves local content, stops autosave, and
requires reload. New drafts use create-if-absent semantics. The server validates
the post/localization pair and strict document contract.

## Alternatives and consequences

Last-write-wins was rejected because it loses work. A version history was rejected
because ADR-0032 reserves revisions for publication. Server locks were rejected as
stateful and fragile. Compare-and-swap adds a visible conflict state but remains
stateless and makes overwrites explicit.

## Amendment — 2026-09-10: idempotent retries

A server-generated replacement token turned a lost response into a permanent
conflict: the write landed, the client kept the old token, and its retry failed
compare-and-swap. The client now generates each attempt's `nextToken` (a UUID)
and sends it with `draftToken`. The server accepts the write when the stored token
equals either one, since a stored `nextToken` means the same attempt already
landed; create-if-absent follows the same rule. A failed attempt is retried with
its own token and its own content before any newer edit goes out under a fresh
token, so a replay never carries content the landed attempt did not. On success
the client adopts `nextToken`.

Related: [ADR-0032](0032-separate-drafts-from-revisions.md), [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md), and [ADR-0034](0034-protect-admin-actions-with-cloudflare-access.md).
