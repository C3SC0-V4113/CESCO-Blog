# ADR-0031: Layer the data path by effect and testability

## Status

Accepted

## Date

2026-08-05

## Context

Nothing has defined how data reaches the interface. The public read path grew one
PR at a time and settled into a shape that works, but the shape was never named,
so nothing stops the next page from reaching for Drizzle directly.

The admin arrives across six PRs and brings the write path with it: validation,
authorization, revision creation, media synchronisation and cache purging. That
is the point where an undefined structure becomes expensive, because every one of
those concerns has somewhere plausible to live and no single obviously correct
home.

The instinct is to reach for the layering used in a C# service — repository
interface, concrete implementation, service, DTOs. It transfers badly here. Its
central promise is substitutability, and D1 is not going to be swapped: the
schema, the migrations, the tests and the runtime all assume it (ADR-0002,
ADR-0005, ADR-0025). Paying its indirection buys a guarantee this project has no
use for.

There is, however, a split already earning its keep. `src/lib/urls.ts` is pure
policy and is tested in jsdom; `src/db/queries/posts.ts` performs I/O and is
tested in workerd against real D1. That division was not designed — it fell out
of what each thing could be tested with, and it maps exactly onto the two test
projects ADR-0025 defines.

## Decision

Layer by **what a module does to the world**, and let the test project each layer
belongs to be the check that the boundary is real.

| Layer             | Contents                                | May touch                 | Tested in     |
| ----------------- | --------------------------------------- | ------------------------- | ------------- |
| `src/db/`         | Schema, client, queries                 | Drizzle, D1               | `integration` |
| `src/lib/<area>/` | Domain rules, derivation, resolution    | Nothing with side effects | `unit`        |
| `src/actions/`    | The write path: validate, mutate, purge | `db/`, `lib/`, bindings   | `integration` |
| `src/pages/`      | Routing, status codes, response shape   | `db/`, `lib/`, `actions/` | `e2e`         |
| `src/components/` | Presentation                            | `lib/`, props             | `unit`, `e2e` |

Two rules, both **enforced by lint** rather than left to review:

1. **A page never imports Drizzle.** It calls a query and shapes a response.
2. **A component never imports from `src/db/`.** It receives data as props.
   Naming the shape stays legal — `import type { PublishedPost }` is allowed —
   because a type carries no runtime coupling. Importing the module that could
   fetch it does not.

Both are `no-restricted-imports` entries scoped by path in `eslint.config.mjs`,
and each error names this ADR so the reason arrives with the failure.

The load-bearing property is the second column. A module with no side effects can
be tested in jsdom in milliseconds, so pushing rules there is what makes them
cheap to test exhaustively — the ADR-0010 decision table is eight jsdom
assertions precisely because the decision was separated from the queries feeding
it. A module that performs I/O has to run in workerd against real D1, which is
slower and worth reserving for what genuinely needs it.

This is descriptive of the read path as it already stands and prescriptive for
the write path. Queries may compose with pure rules — `resolveArticleUrl` reads
three tables and delegates the decision to `resolveLocalizationUrl` — and that
composition is the intended shape, not a violation. The rule is about where logic
_lives_, not about forbidding a layer from calling the one below it.

### Astro actions or API routes

Use **Astro actions** for the admin write path. They carry typed input,
server-side Zod validation and a typed result back to the island, which is what a
form mutation needs and what ADR-0023's client-rendered admin can consume
directly.

Use an **API route** where something needs the raw `Request`/`Response` that
actions abstract away: streaming a file body to R2 (ADR-0024, ADR-0028), or
anything answering a caller that is not our own client.

The rule of thumb: an action if our island is calling it with structured data, a
route if something needs the HTTP envelope.

## Consequences

### Positive

- The two boundary rules fail the build rather than depending on a reviewer
  noticing, and the failure explains itself.
- Rules land where they are cheapest to test exhaustively, and the two test
  projects stop being an accident of tooling and become the shape of the code.
- The write path has a defined home before six admin PRs start filling it.
- No indirection is added for substitutability that will never be exercised.

### Negative

- `lib/` will accumulate areas and needs its own internal organisation before it
  becomes a folder of loose files.
- The action-or-route line requires a judgement per endpoint. It is a rule of
  thumb, not a lookup table, and the first genuinely ambiguous case will need a
  ruling.
- Only the two import rules are enforced. The rest of the table — which layer
  owns which concern — is still a convention, and a query with business rules
  buried in it passes lint exactly like a clean one.

## Related Decisions

- [ADR-0002](0002-use-d1-for-content-storage.md)
- [ADR-0005](0005-use-drizzle-for-d1-schema-and-migrations.md)
- [ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md)
- [ADR-0025](0025-test-d1-through-the-workers-vitest-pool.md)
