import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, because they cannot share a runtime (ADR-0025).
 *
 * - `unit` runs React components in jsdom.
 * - `integration` runs inside workerd with a real D1 binding, so data rules are
 *   verified against the engine that ships rather than a stand-in.
 */
export default defineConfig(async () => {
  // Drizzle writes its migrations here; the same files that `wrangler d1
  // migrations apply` uses locally are applied to the test database.
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'drizzle'));

  return {
    test: {
      projects: [
        {
          plugins: [react()],
          resolve: { tsconfigPaths: true },
          test: {
            name: 'unit',
            environment: 'jsdom',
            include: ['tests/unit/**/*.test.{ts,tsx}'],
            restoreMocks: true,
            // jsdom startup dominates a cold run and is charged to the first
            // test, which intermittently blew the 5s default. Raised enough to
            // absorb that without masking a genuinely hung test.
            testTimeout: 20_000,
          },
        },
        {
          plugins: [
            cloudflareTest({
              // Bindings are declared here rather than loaded from
              // wrangler.jsonc on purpose. That file's `main` is the Astro
              // adapter entrypoint, a package specifier that only resolves
              // after a build, and these tests exercise the data layer rather
              // than the deployed Worker. Keep this list in sync with
              // wrangler.jsonc when bindings change.
              miniflare: {
                compatibilityDate: '2026-07-18',
                compatibilityFlags: ['nodejs_compat'],
                d1Databases: ['DB'],
                r2Buckets: ['BUCKET'],
                // Test-only binding so the setup file can apply migrations.
                bindings: { TEST_MIGRATIONS: migrations },
              },
            }),
          ],
          resolve: { tsconfigPaths: true },
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts'],
            setupFiles: ['./tests/integration/apply-migrations.ts'],
            restoreMocks: true,
          },
        },
      ],
    },
  };
});
