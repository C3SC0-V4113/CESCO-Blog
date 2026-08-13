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

Related: [ADR-0032](0032-separate-drafts-from-revisions.md), [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md), and [ADR-0034](0034-protect-admin-actions-with-cloudflare-access.md).
