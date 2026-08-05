import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

/**
 * `TEST_MIGRATIONS` is injected by `vitest.config.mts` through Miniflare and
 * exists only while integration tests run. It is read through a cast rather than
 * declared on the global `Env`, because `Env` describes production bindings and
 * a test-only binding does not belong there.
 */
const testEnv = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };

// Setup files run outside per-test-file storage isolation and may run more than
// once. `applyD1Migrations` only applies migrations that have not been applied
// yet, so calling it here is safe.
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
