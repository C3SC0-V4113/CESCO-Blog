/// <reference types="@cloudflare/workers-types" />
import { createDb, type Db } from '@/db/client';

/**
 * The single place application code reaches Cloudflare bindings (ADR-0025).
 *
 * The Astro Cloudflare adapter exposes bindings at `Astro.locals.runtime.env`.
 * Reading that path directly from a page spreads runtime knowledge across the
 * codebase and makes bindings hard to stub, so pages call these helpers instead.
 */

type RuntimeLocals = {
  runtime: {
    env: Env;
    ctx: ExecutionContext;
  };
};

export function getEnv(locals: RuntimeLocals): Env {
  return locals.runtime.env;
}

export function getDb(locals: RuntimeLocals): Db {
  return createDb(locals.runtime.env.DB);
}

export function getBucket(locals: RuntimeLocals): R2Bucket {
  return locals.runtime.env.BUCKET;
}

/**
 * Work that should outlive the response — cache purges, analytics writes.
 * Without this the Worker may be torn down before the promise settles.
 */
export function runAfterResponse(locals: RuntimeLocals, work: Promise<unknown>): void {
  locals.runtime.ctx.waitUntil(work);
}
