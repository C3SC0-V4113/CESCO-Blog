import { describe, expect, it, vi } from 'vitest';

import { schema } from '@/db/client';
import { getBucket, getDb, runAfterResponse } from '@/lib/runtime';

/**
 * This module is the single seam between pages and Cloudflare bindings, so if
 * it stops resolving them every data-backed page breaks at once.
 *
 * These live in the workerd project rather than in jsdom on purpose. The
 * previous version of this suite ran in jsdom against a hand-built
 * `{ runtime: { env, ctx } }` object and passed for months while the real
 * accessor could not have worked: Astro v6 removed `Astro.locals.runtime.env`
 * and the adapter replaced it with a getter that throws. A stub shaped like the
 * assumption cannot catch the assumption being wrong — only the real binding
 * can.
 */

describe('runtime accessors', () => {
  it('resolves a working D1 binding', async () => {
    // A real query, not a truthiness check: the point is that the binding is
    // live, not merely present.
    await expect(getDb().select().from(schema.posts).limit(1)).resolves.toBeDefined();
  });

  it('resolves the R2 binding', () => {
    expect(getBucket()).toBeDefined();
  });

  it('defers work past the response through the execution context', () => {
    const waitUntil = vi.fn();
    // Typed as the adapter's own `App.Locals`, so if `cfContext` moves again the
    // compiler says so instead of a test passing against a stale shape.
    const locals = { cfContext: { waitUntil } } as unknown as App.Locals;

    const work = Promise.resolve();
    runAfterResponse(locals, work);

    // Cache purges (ADR-0011) must not be dropped when the Worker is torn down.
    expect(waitUntil).toHaveBeenCalledWith(work);
  });
});
