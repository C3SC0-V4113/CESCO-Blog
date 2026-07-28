# ADR-0005: Use Drizzle for D1 schema and migrations

## Status

Accepted

## Context

Cesco Blog uses Cloudflare D1 for content storage. The project needs a typed
schema, repeatable migrations, and a local workflow that runs through Wrangler so
development matches the Cloudflare runtime.

## Decision

Use Drizzle ORM and Drizzle Kit for the D1 schema and migration generation.

The app will use:

- `drizzle-orm/d1` at runtime with the `DB` D1 binding.
- `drizzle-kit generate` to create SQL migrations from `src/db/schema.ts`.
- `wrangler d1 migrations apply` for local and remote migration application.
- `wrangler.jsonc` as the source of truth for Cloudflare bindings.

## Consequences

### Positive

- Keeps schema definitions type-safe and version-controlled.
- Uses Cloudflare-native D1 migration application.
- Makes local D1 development explicit through Wrangler.

### Negative

- Remote migration workflows require Cloudflare account, database, and token
  setup outside the repo.
- Drizzle-generated SQL remains an artifact that reviewers must inspect.

## Related decisions

- [ADR-0001](0001-adopt-cloudflare-runtime.md)
- [ADR-0002](0002-use-d1-for-content-storage.md)
