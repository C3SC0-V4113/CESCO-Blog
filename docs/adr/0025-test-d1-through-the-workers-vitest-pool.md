# ADR-0025: Test D1 through the Workers Vitest pool

## Status

Accepted

## Date

2026-08-04

## Context

Nearly every ADR written so far carries a test plan, and almost all of those
plans require a populated database: a post published in Spanish and never in
English, a localization withdrawn after publication, a slug renamed twice.

None of them could run. `tests/integration/` appeared in the Vitest include glob
but did not exist on disk, and there was no database harness of any kind. With
Strict TDD in force, that made it impossible to write the first failing test for
any data-backed surface.

The existing configuration runs React components in jsdom. A D1 harness cannot
share it: workerd is a different runtime, not a different environment.

## Decision

Use `@cloudflare/vitest-pool-workers`, which runs tests inside workerd with D1
provided by Miniflare.

`vitest.config.mts` declares **two Vitest projects**:

| Project       | Runtime              | Covers                          |
| ------------- | -------------------- | ------------------------------- |
| `unit`        | jsdom + React plugin | Components, pure utilities      |
| `integration` | workerd + D1         | Data rules, and later endpoints |

Migrations come from `drizzle/` — the same files `wrangler d1 migrations apply`
uses — read at config time by `readD1Migrations`, passed in through a test-only
`TEST_MIGRATIONS` binding, and applied by a setup file. The tests therefore run
against the schema that actually ships.

That test-only binding is read through a cast at its single use site rather than
being declared on the global `Env`. `Env` describes production bindings, and a
test fixture does not belong in it.

**The integration project declares its bindings directly instead of loading
`wrangler.jsonc`.** That file's `main` is the Astro adapter entrypoint, a package
specifier that only resolves after a build, and pointing the pool at it fails.
These tests exercise the data layer rather than the deployed Worker, so they do
not need an entrypoint. The cost is that the binding list is duplicated and must
be kept in sync when `wrangler.jsonc` changes.

Rejected alternatives:

| Option                     | Why not                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-sqlite3` in memory | Faster and fits the existing config, but tests a stand-in rather than D1 — no bindings, no D1 quirks, no query ceiling. It is also a native module, which adds build friction on Windows |
| One harness for everything | The two runtimes are incompatible; forcing one would mean giving up either component tests or real D1                                                                                    |
| Both harnesses             | Cheapest per test, but two harnesses to maintain and a rule to remember at every test                                                                                                    |

Fixture builders live in `tests/integration/fixtures.ts` and express lifecycle
**transitions**, not just states — withdrawal, renaming, publishing a second
locale — because that is where the rules in ADR-0010 actually live.

## Consequences

### Positive

- Data rules are verified against the engine that ships, including the 50-query
  ceiling from ADR-0016.
- Migrations are exercised on every run, so a broken migration fails in tests
  rather than on deploy.
- TDD is unblocked for every data-backed surface.
- Fixtures make lifecycle scenarios readable instead of twenty inserts.

### Negative

- Integration tests are slower than an in-memory database would be.
- The binding list is duplicated between `wrangler.jsonc` and the test config,
  with nothing detecting drift.
- Endpoint tests that need the Worker entrypoint are not possible under this
  configuration and will need a separate approach once RSS and sitemap exist.
- `workerd` must be allowed to run its install script, so `pnpm-workspace.yaml`
  carries an entry that a fresh clone depends on.

## Related Decisions

- [ADR-0005](0005-use-drizzle-for-d1-schema-and-migrations.md)
- [ADR-0010](0010-define-public-url-lifecycle-for-localized-posts.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
- [ADR-0026](0026-generate-identifiers-with-crypto-randomuuid.md)
