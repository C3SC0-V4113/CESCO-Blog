import { env } from 'cloudflare:test';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { saveDraft } from '@/actions/drafts';
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
  it('moves a post forward after draft inserts and updates, but not after a conflict', async () => {
    const db = createDb(env.DB);
    const [editedPostId, otherPostId] = [newPostId(), newPostId()];
    const localizationId = newPostLocalizationId();
    const otherLocalizationId = newPostLocalizationId();
    const originalTimestamp = '2000-01-01 00:00:00';
    await db.update(schema.posts).set({ updatedAt: '1999-01-01 00:00:00' });
    await db.batch([
      db.insert(schema.posts).values([
        { id: editedPostId, section: 'analysis', updatedAt: originalTimestamp },
        { id: otherPostId, section: 'opinion', updatedAt: '2001-01-01 00:00:00' },
      ]),
      db.insert(schema.postLocalizations).values([
        { id: localizationId, postId: editedPostId, locale: 'en', slug: `edited-${editedPostId}` },
        {
          id: otherLocalizationId,
          postId: otherPostId,
          locale: 'en',
          slug: `other-${otherPostId}`,
        },
      ]),
    ]);

    const firstToken = crypto.randomUUID();
    await saveDraft(db, {
      postId: editedPostId,
      localizationId,
      draftToken: null,
      nextToken: firstToken,
      title: 'First save',
      excerpt: null,
      contentJson: { type: 'doc', content: [] },
    });
    expect((await listAdminPosts(db, { limit: 10, offset: 0 })).posts[0]?.id).toBe(editedPostId);

    await db
      .update(schema.posts)
      .set({ updatedAt: originalTimestamp })
      .where(eq(schema.posts.id, editedPostId));
    const secondToken = crypto.randomUUID();
    await saveDraft(db, {
      postId: editedPostId,
      localizationId,
      draftToken: firstToken,
      nextToken: secondToken,
      title: 'Updated save',
      excerpt: null,
      contentJson: { type: 'doc', content: [] },
    });
    expect((await listAdminPosts(db, { limit: 10, offset: 0 })).posts[0]?.id).toBe(editedPostId);

    await db
      .update(schema.posts)
      .set({ updatedAt: originalTimestamp })
      .where(eq(schema.posts.id, editedPostId));
    await expect(
      saveDraft(db, {
        postId: editedPostId,
        localizationId,
        draftToken: firstToken,
        nextToken: crypto.randomUUID(),
        title: 'Conflicting save',
        excerpt: null,
        contentJson: { type: 'doc', content: [] },
      })
    ).rejects.toThrow('draft-conflict');
    const [post] = await db
      .select({ updatedAt: schema.posts.updatedAt })
      .from(schema.posts)
      .where(eq(schema.posts.id, editedPostId));
    expect(post?.updatedAt).toBe(originalTimestamp);
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
    // The island words the conflict from the code; a server message would be a
    // second, untranslated copy of it.
    expect(adminPostError(Error('slug-reserved'), logger)).toEqual({ code: 'CONFLICT' });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
