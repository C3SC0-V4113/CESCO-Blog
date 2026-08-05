# ADR-0026: Generate identifiers with crypto.randomUUID()

## Status

Accepted

## Date

2026-08-04

## Context

Every table declares `text('id').primaryKey()` with no default, and nothing in
the codebase generated one. The seed script of ADR-0017 could not insert a single
row.

Two identifiers are public contracts rather than internal keys. A post
localization ID is the RSS `guid` (ADR-0014), chosen precisely because slugs are
mutable, so it must be permanent and must never be regenerated for an existing
row.

Identifiers do **not** carry ordering responsibility here: listings and feeds
order by `first_published_at` and revisions by `version`. That removes the usual
argument for time-sortable identifiers.

## Decision

Use `crypto.randomUUID()`, wrapped in named helpers in `src/lib/ids.ts`.

It is native in workerd, in Node for the seed script, and in the browser for the
admin — one implementation across all three, no dependency.

The wrappers exist so the strategy lives in one file rather than at every insert
site. Only entities with an existing insert site have a wrapper; the rest are
added when their first caller appears, because an exported name with no caller is
maintenance surface rather than preparation.

Rejected alternatives:

| Option | Why not                                                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UUIDv7 | Time-sortable and pleasant to debug, but `first_published_at` and `version` already provide ordering, and it needs a dependency or a hand-rolled implementation |
| nanoid | Shorter and URL-friendly, but no identifier appears in a URL — URLs use slugs — and it adds a dependency for no gain                                            |

## Consequences

### Positive

- No dependency, and identical behaviour in the Worker, the seed script, and the
  admin.
- The strategy can change in one file rather than across every insert.
- Random identifiers leak no creation-order information in public feeds.

### Negative

- Identifiers carry no timestamp, so debugging cannot infer creation order from
  them.
- Random UUIDs have poorer index locality than sequential ones; irrelevant at
  this scale, but it is a real property.
- Nothing enforces that a localization ID is never regenerated — the RSS `guid`
  contract depends on discipline and a test, not on the type system.

## Related Decisions

- [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)
- [ADR-0017](0017-bootstrap-content-with-seed-script.md)
- [ADR-0025](0025-test-d1-through-the-workers-vitest-pool.md)
