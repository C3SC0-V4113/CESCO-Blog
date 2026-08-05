import { describe, expect, it, vi } from 'vitest';

import { getBucket, getDb, getEnv, runAfterResponse } from '@/lib/runtime';

/**
 * `locals` stands in for what the Astro Cloudflare adapter injects. These tests
 * exist because this module is the single seam between pages and bindings — if
 * it stops resolving them, every data-backed page breaks at once.
 */
function fakeLocals() {
  const waitUntil = vi.fn();
  const env = {
    DB: { __brand: 'd1' },
    BUCKET: { __brand: 'r2' },
  };

  return {
    locals: { runtime: { env, ctx: { waitUntil } } } as never,
    env,
    waitUntil,
  };
}

describe('runtime accessors', () => {
  it('exposes the environment from locals', () => {
    const { locals, env } = fakeLocals();
    expect(getEnv(locals)).toBe(env);
  });

  it('builds a Drizzle client over the D1 binding', () => {
    const { locals } = fakeLocals();
    expect(getDb(locals)).toBeDefined();
  });

  it('exposes the R2 bucket', () => {
    const { locals, env } = fakeLocals();
    expect(getBucket(locals)).toBe(env.BUCKET);
  });

  it('defers work past the response through waitUntil', () => {
    const { locals, waitUntil } = fakeLocals();
    const work = Promise.resolve();

    runAfterResponse(locals, work);

    // Cache purges (ADR-0011) must not be dropped when the Worker is torn down.
    expect(waitUntil).toHaveBeenCalledWith(work);
  });
});
