import { env } from 'cloudflare:test';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { adminPostError, createAdminPost } from '@/actions/posts';
import { createDb, schema } from '@/db/client';
import { listAdminPosts } from '@/db/queries/admin-posts';
import { newPostId, newPostLocalizationId, newSlugHistoryId } from '@/lib/ids';
describe('admin post aggregates', () => {
  it('lists one row per aggregate with locale statuses and stable ordering', async () => {
    const db = createDb(env.DB);
    const [newerId, olderId] = [newPostId(), newPostId()];
    await db.batch([
      db.insert(schema.posts).values([
        { id: newerId, section: 'analysis', updatedAt: '2026-08-12 12:00:00' },
        { id: olderId, section: 'opinion', updatedAt: '2026-08-11 12:00:00' },
      ]),
      db.insert(schema.postLocalizations).values([
        { id: newPostLocalizationId(), postId: newerId, locale: 'es', slug: 'nuevo' },
        { id: newPostLocalizationId(), postId: newerId, locale: 'en', slug: 'new' },
        { id: newPostLocalizationId(), postId: olderId, locale: 'es', slug: 'anterior' },
      ]),
    ]);
    const page = await listAdminPosts(db, { limit: 10, offset: 0 });
    expect(
      page.posts.map(({ id, displayName, locales }) => ({ id, displayName, locales }))
    ).toEqual([
      { id: newerId, displayName: 'nuevo', locales: { es: 'draft', en: 'draft' } },
      { id: olderId, displayName: 'anterior', locales: { es: 'draft', en: 'missing' } },
    ]);
  });
  it('atomically creates only the aggregate and first draft localization', async () => {
    const db = createDb(env.DB);
    const input = { section: 'opinion', locale: 'en', slug: 'first-draft' } as const;
    const result = await createAdminPost(db, input);
    const posts = await db.select().from(schema.posts).where(eq(schema.posts.id, result.postId));
    expect(posts).toHaveLength(1);
    const localizations = await db
      .select()
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.postId, result.postId));
    expect(localizations).toMatchObject([{ locale: 'en', slug: 'first-draft', status: 'draft' }]);
    expect(await db.select().from(schema.postRevisions)).toEqual([]);
  });
  it('reserves every slug and rolls back a failed localization insert', async () => {
    const db = createDb(env.DB);
    const [ownerId, localizationId] = [newPostId(), newPostLocalizationId()];
    await db.batch([
      db.insert(schema.posts).values({ id: ownerId, section: 'analysis' }),
      db.insert(schema.postLocalizations).values({
        id: localizationId,
        postId: ownerId,
        locale: 'es',
        slug: 'live-slug',
      }),
      db.insert(schema.postLocalizationSlugHistory).values({
        id: newSlugHistoryId(),
        postLocalizationId: localizationId,
        locale: 'es',
        oldSlug: 'retired-slug',
      }),
    ]);
    const before = await db.select({ count: sql<number>`count(*)` }).from(schema.posts);
    for (const slug of ['live-slug', 'retired-slug'])
      await expect(
        createAdminPost(db, { section: 'analysis', locale: 'es', slug })
      ).rejects.toThrow('slug-reserved');
    expect(await db.select({ count: sql<number>`count(*)` }).from(schema.posts)).toEqual(before);
    const attemptedPostId = newPostId();
    const input = { section: 'analysis', locale: 'en', slug: 'rollback' } as const;
    await expect(createAdminPost(db, input, [attemptedPostId, localizationId])).rejects.toThrow();
    expect(
      await db.select().from(schema.posts).where(eq(schema.posts.id, attemptedPostId))
    ).toEqual([]);
    const logger = { error: vi.fn() };
    expect(adminPostError(Error('D1'), logger)).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
