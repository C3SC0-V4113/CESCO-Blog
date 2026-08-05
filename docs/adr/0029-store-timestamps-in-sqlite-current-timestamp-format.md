# ADR-0029: Store timestamps in SQLite's CURRENT_TIMESTAMP format

## Status

Accepted

## Date

2026-08-04

## Context

This decision came out of building the test fixtures, not out of design review.

Every date column in the schema is TEXT, and several default to SQLite's
`CURRENT_TIMESTAMP`, which produces `YYYY-MM-DD HH:MM:SS` in UTC — a space
separator, no timezone marker. Application code had no stated format, so the
natural choice would have been `Date.prototype.toISOString()`, which produces
`YYYY-MM-DDTHH:MM:SS.sssZ`.

Mixing the two in one TEXT column corrupts ordering, and ordering is
load-bearing: listings and RSS order by `first_published_at DESC` (ADR-0014).

The corruption is narrow, which is what makes it dangerous. String comparison
proceeds character by character, so for timestamps on **different dates** the
year decides long before the separator and ordering survives. Only when the date
matches does comparison reach index 10, where the space (`0x20`) sorts before
`T` (`0x54`) — so a `23:00` space-formatted row sorts ahead of a `01:00` ISO one
from the same day.

The result is a feed that is correct across weeks and silently wrong among posts
published on the same day. That reads as a random glitch, not a format problem.

## Decision

All application writes to text date columns use SQLite's format:
`YYYY-MM-DD HH:MM:SS`, UTC.

`src/lib/timestamps.ts` is the single source: `toDbTimestamp()` produces it and
`fromDbTimestamp()` parses it back as UTC. Date rendering goes through
`formatDate` in `src/i18n/utils.ts`, which parses via that helper.

ISO 8601 is the better interchange format in the abstract. It is not chosen here
because the column defaults already emit SQLite's format, and consistency within
a column matters more than the merits of either format. Migrating to ISO would
mean rewriting every default and backfilling every existing row to gain nothing
this project needs.

A unit test asserts that lexicographic order matches chronological order, and a
second test documents the same-day corruption directly, so the reason for the
constraint survives in executable form rather than only in this file.

## Consequences

### Positive

- Ordering by a text date column is correct in every case, which is what ADR-0014
  depends on.
- Column defaults and application writes produce identical values, so a row's
  origin cannot be inferred — or broken — by its format.
- The rule is enforced by a helper and covered by tests rather than by memory.

### Negative

- The stored format is not ISO 8601, so anything consuming D1 directly must
  parse it deliberately.
- The absence of a timezone marker makes UTC an implicit convention; reading a
  value as local time is an easy mistake.
- Sub-second precision is discarded, so two writes within the same second are
  indistinguishable by timestamp.
- Nothing prevents a future call from writing `toISOString()` directly; only
  review and the tests catch it.

## Related Decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)
- [ADR-0025](0025-test-d1-through-the-workers-vitest-pool.md)
