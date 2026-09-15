import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { schema } from '@/db/client';
import { findFeaturedPost, listPublishedPosts } from '@/db/queries/listings';

import { at, resetContent, seedPost, testDb } from './fixtures';

/**
 * The home shows the featured slot above the latest list, so the list must
 * leave out exactly the post the slot shows — no more, and not only on the
 * page it happens to land on, or the count and the pages drift apart.
 */

const PAGE = { limit: 10, offset: 0 };

beforeEach(async () => {
  await resetContent(testDb());
});

async function feature(db: ReturnType<typeof testDb>, localizationId: string, when: string) {
  await db
    .update(schema.postLocalizations)
    .set({ featuredAt: at(when) })
    .where(eq(schema.postLocalizations.id, localizationId));
}

describe('the latest list beside the featured slot', () => {
  it('leaves the featured post out of the list and out of its count', async () => {
    const db = testDb();
    const featured = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'destacada', publishedAt: at('2026-06-01T10:00:00Z') }],
    });
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'reciente', publishedAt: at('2026-05-01T10:00:00Z') }],
    });
    await feature(db, featured.localizations[0]!.id, '2026-06-02T10:00:00Z');

    expect(await findFeaturedPost(db, 'es')).toMatchObject({ slug: 'destacada' });
    const latest = await listPublishedPosts(db, { locale: 'es', ...PAGE, excludeFeatured: true });

    expect(latest.posts.map((p) => p.slug)).toEqual(['reciente']);
    expect(latest.total).toBe(1);
  });

  it('keeps every post when nothing is featured', async () => {
    // With no featured post the comparison meets NULL, and a plain `<>` would
    // quietly empty the whole list.
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'unica', publishedAt: at('2026-05-01T10:00:00Z') }],
    });

    const latest = await listPublishedPosts(db, { locale: 'es', ...PAGE, excludeFeatured: true });

    expect(latest.posts.map((p) => p.slug)).toEqual(['unica']);
    expect(latest.total).toBe(1);
  });

  it('excludes only the post the slot shows, not every post ever featured', async () => {
    const db = testDb();
    const earlier = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'antes', publishedAt: at('2026-05-01T10:00:00Z') }],
    });
    const current = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'ahora', publishedAt: at('2026-04-01T10:00:00Z') }],
    });
    await feature(db, earlier.localizations[0]!.id, '2026-06-01T10:00:00Z');
    await feature(db, current.localizations[0]!.id, '2026-06-03T10:00:00Z');

    expect(await findFeaturedPost(db, 'es')).toMatchObject({ slug: 'ahora' });
    const latest = await listPublishedPosts(db, { locale: 'es', ...PAGE, excludeFeatured: true });

    expect(latest.posts.map((p) => p.slug)).toEqual(['antes']);
  });
});
