/// <reference types="@cloudflare/workers-types" />
import { env } from 'cloudflare:workers';

import { createDb, type Db } from '@/db/client';

import type { Runtime } from '@astrojs/cloudflare';

/**
 * The single place application code reaches Cloudflare bindings (ADR-0025).
 *
 * Bindings come from the `cloudflare:workers` module, not from
 * `Astro.locals.runtime.env`. That path was removed in Astro v6 — the adapter
 * now installs a getter there that throws with exactly this instruction — so
 * anything still reading it fails on the first request rather than at build
 * time. The same import is what the integration tests already use, which means
 * tests and pages resolve bindings through one mechanism instead of two.
 *
 * Pages call these helpers rather than importing `env` directly, so the set of
 * bindings a page may touch stays enumerable in one file.
 */

export function getDb(): Db {
  return createDb(env.DB);
}

export function getBucket(): R2Bucket {
  return env.BUCKET;
}

/**
 * Work that should outlive the response — cache purges (ADR-0011), analytics
 * writes. Without it the Worker may be torn down before the promise settles.
 *
 * The execution context lives at `Astro.locals.cfContext`; it is the one piece
 * of runtime state that is still per-request and therefore cannot come from the
 * module-level import above.
 *
 * Typed against the adapter's own `Runtime` rather than the ambient
 * `App.Locals`. That global only exists once Astro has generated `.astro/`,
 * which is gitignored — so on a clean checkout the ambient version silently
 * loses `cfContext` and the build fails somewhere that has nothing to do with
 * this file. Importing the type names the dependency instead of assuming it.
 */
export function runAfterResponse(locals: Runtime, work: Promise<unknown>): void {
  locals.cfContext.waitUntil(work);
}
