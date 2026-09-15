import { env } from 'cloudflare:test';
import { asc, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import {
  createAuthor,
  createCollection,
  saveCollection,
  saveSeoDraft,
  setFeaturedLocalization,
  updateAuthor,
} from '@/actions/admin-taxonomy';
import { saveDraft } from '@/actions/drafts';
import { retryPendingPurges } from '@/actions/pending-purges';
import { createDb, schema } from '@/db/client';
import { resolveCollectionUrl } from '@/db/queries/collections';
import { findFeaturedPost } from '@/db/queries/listings';
import { resolveArticleUrl } from '@/db/queries/posts';

const db = () => createDb(env.DB);
const media = async (database: ReturnType<typeof db>, id = crypto.randomUUID()) => {
  await database.insert(schema.mediaAssets).values({
    id,
    r2Key: `media/2026/08/${id}.webp`,
    contentType: 'image/webp',
    width: 1200,
    height: 628,
  });
  return id;
};

async function post(database: ReturnType<typeof db>, locale: 'es' | 'en', status = 'published') {
  const postId = crypto.randomUUID();
  const localizationId = crypto.randomUUID();
  await database.insert(schema.posts).values({ id: postId, section: 'analysis' });
  await database.insert(schema.postLocalizations).values({
    id: localizationId,
    postId,
    locale,
    slug: `${locale}-${postId}`,
    status: status as 'draft' | 'published',
    firstPublishedAt: status === 'published' ? '2026-08-20 12:00:00' : null,
  });
  if (status === 'published') {
    const revisionId = crypto.randomUUID();
    await database.insert(schema.postRevisions).values({
      id: revisionId,
      postLocalizationId: localizationId,
      version: 1,
      title: `${locale} title`,
      contentJson: { type: 'doc', content: [] },
    });
    await database
      .update(schema.postLocalizations)
      .set({ publishedRevisionId: revisionId })
      .where(eq(schema.postLocalizations.id, localizationId));
  }
  return { postId, localizationId };
}

const noSeo = {
  seoTitle: null,
  seoDescription: null,
  ogTitle: null,
  ogDescription: null,
  ogImageMediaId: null,
  ogImageAlt: null,
  coverMediaId: null,
  authorId: null,
};

const draftRow = (database: ReturnType<typeof db>, localizationId: string) =>
  database
    .select()
    .from(schema.postDrafts)
    .where(eq(schema.postDrafts.postLocalizationId, localizationId));

describe('authors', () => {
  it('creates and updates a safe profile while preserving unique normalized slugs', async () => {
    const database = db();
    const avatarMediaId = await media(database);
    const id = crypto.randomUUID();
    await createAuthor(database, {
      id,
      slug: 'Césco Valle',
      name: 'Cesco Valle',
      bio: 'Bio',
      avatarMediaId,
      websiteUrl: 'https://example.com',
      sameAs: ['https://social.example/cesco'],
    });
    expect(
      await database.select().from(schema.authors).where(eq(schema.authors.id, id))
    ).toMatchObject([{ slug: 'cesco-valle', avatarMediaId }]);

    const assigned = await post(database, 'en');
    await database
      .update(schema.posts)
      .set({ authorId: id })
      .where(eq(schema.posts.id, assigned.postId));
    const failedPurge = vi.fn().mockRejectedValue(Error('purge unavailable'));
    await expect(
      updateAuthor(
        database,
        {
          id,
          slug: 'Cesco',
          name: 'Cesco V.',
          bio: null,
          avatarMediaId: null,
          websiteUrl: null,
          sameAs: [],
        },
        failedPurge
      )
    ).resolves.toMatchObject({ status: 'saved-with-cache-warning' });
    expect(failedPurge).toHaveBeenCalledWith(
      expect.arrayContaining([`post-${assigned.postId}`, 'locale-en'])
    );
    expect(
      await database.select().from(schema.authors).where(eq(schema.authors.id, id))
    ).toMatchObject([{ slug: 'cesco', name: 'Cesco V.', sameAs: [] }]);

    await expect(
      createAuthor(database, {
        id: crypto.randomUUID(),
        slug: 'Cesco',
        name: 'Duplicate',
        avatarMediaId: null,
        websiteUrl: null,
        sameAs: [],
      })
    ).rejects.toThrow('author-slug-reserved');
  });
});

describe('collections', () => {
  const spanish = (id: string, slug: string, status: 'draft' | 'published' = 'draft') => ({
    id,
    locale: 'es' as const,
    slug,
    title: 'Serie',
    description: null,
    status,
  });

  it('writes bilingual lifecycle and contiguous authored membership atomically', async () => {
    const database = db();
    const first = await post(database, 'es');
    const second = await post(database, 'es', 'draft');
    const collectionId = crypto.randomUUID();
    const esId = crypto.randomUUID();
    const enId = crypto.randomUUID();
    await createCollection(database, { id: collectionId });
    const purge = vi.fn().mockResolvedValue(undefined);
    const input = {
      id: collectionId,
      editorialState: 'active' as const,
      localizations: [
        {
          id: esId,
          locale: 'es' as const,
          slug: 'Saga Sonora',
          title: 'Saga sonora',
          description: 'ES',
          status: 'published' as const,
        },
        {
          id: enId,
          locale: 'en' as const,
          slug: 'Sound Saga',
          title: 'Sound saga',
          description: 'EN',
          status: 'draft' as const,
        },
      ],
      postIds: [second.postId, first.postId],
    };
    await saveCollection(database, input, purge, new Date('2026-08-21T10:00:00Z'));
    expect(
      await database
        .select({
          postId: schema.collectionPosts.postId,
          position: schema.collectionPosts.position,
        })
        .from(schema.collectionPosts)
        .where(eq(schema.collectionPosts.collectionId, collectionId))
        .orderBy(asc(schema.collectionPosts.position))
    ).toEqual([
      { postId: second.postId, position: 0 },
      { postId: first.postId, position: 1 },
    ]);
    expect(
      await database
        .select({
          locale: schema.collectionLocalizations.locale,
          first: schema.collectionLocalizations.firstPublishedAt,
        })
        .from(schema.collectionLocalizations)
        .where(eq(schema.collectionLocalizations.collectionId, collectionId))
    ).toEqual(
      expect.arrayContaining([
        { locale: 'es', first: '2026-08-21 10:00:00' },
        { locale: 'en', first: null },
      ])
    );
    expect(purge).toHaveBeenCalledWith(
      expect.arrayContaining([
        `collection-${collectionId}`,
        'series',
        `post-${first.postId}`,
        `post-${second.postId}`,
      ])
    );
    await expect(
      saveCollection(database, input, vi.fn().mockRejectedValue(Error('purge unavailable')))
    ).resolves.toEqual({ status: 'saved-with-cache-warning' });
    // The failed tags outlive the request, so the review queue can settle them
    // after the tab that saved is gone (ADR-0037).
    const retry = vi.fn().mockResolvedValue(undefined);
    await expect(retryPendingPurges(database, retry)).resolves.toEqual({ status: 'purged' });
    expect(retry).toHaveBeenCalledWith(
      expect.arrayContaining([`collection-${collectionId}`, 'series', `post-${first.postId}`])
    );
    expect(await database.select().from(schema.pendingCachePurges)).toEqual([]);
  });

  it('creates a Spanish-only series and serves it only in Spanish', async () => {
    const database = db();
    const collectionId = crypto.randomUUID();
    const slug = `solo-espanol-${collectionId}`;
    await createCollection(database, { id: collectionId });
    await expect(
      saveCollection(
        database,
        {
          id: collectionId,
          editorialState: 'active',
          localizations: [spanish(crypto.randomUUID(), slug, 'published')],
          postIds: [],
        },
        vi.fn().mockResolvedValue(undefined)
      )
    ).resolves.toEqual({ status: 'saved' });
    expect(
      await database
        .select({ locale: schema.collectionLocalizations.locale })
        .from(schema.collectionLocalizations)
        .where(eq(schema.collectionLocalizations.collectionId, collectionId))
    ).toEqual([{ locale: 'es' }]);
    expect(await resolveCollectionUrl(database, { locale: 'es', slug })).toMatchObject({
      kind: 'render',
    });
    expect(await resolveCollectionUrl(database, { locale: 'en', slug })).toMatchObject({
      kind: 'not-found',
    });
  });

  it('reports a slug another collection already uses as reserved, on create and on rename', async () => {
    const database = db();
    const purge = vi.fn().mockResolvedValue(undefined);
    const owner = crypto.randomUUID();
    const rival = crypto.randomUUID();
    const taken = `ocupado-${owner}`;
    const free = `libre-${rival}`;
    const rivalLocalization = crypto.randomUUID();
    const save = (id: string, localizationId: string, slug: string) =>
      saveCollection(
        database,
        {
          id,
          editorialState: 'active',
          localizations: [spanish(localizationId, slug)],
          postIds: [],
        },
        purge
      );
    await createCollection(database, { id: owner });
    await createCollection(database, { id: rival });
    await save(owner, crypto.randomUUID(), taken);

    await expect(save(rival, rivalLocalization, taken)).rejects.toThrow('collection-slug-reserved');
    await save(rival, rivalLocalization, free);
    await expect(save(rival, rivalLocalization, taken)).rejects.toThrow('collection-slug-reserved');
    expect(
      await database
        .select({ slug: schema.collectionLocalizations.slug })
        .from(schema.collectionLocalizations)
        .where(eq(schema.collectionLocalizations.collectionId, rival))
    ).toEqual([{ slug: free }]);
  });

  it('blocks a published collection slug through the server action and preserves first publication', async () => {
    const database = db();
    const collectionId = crypto.randomUUID();
    const localizationId = crypto.randomUUID();
    await database.insert(schema.collections).values({ id: collectionId });
    await database.insert(schema.collectionLocalizations).values({
      id: localizationId,
      collectionId,
      locale: 'es',
      slug: 'original',
      title: 'Original',
      status: 'draft',
      firstPublishedAt: '2026-08-20 12:00:00',
    });
    await expect(
      saveCollection(
        database,
        {
          id: collectionId,
          editorialState: 'active',
          localizations: [
            {
              id: localizationId,
              locale: 'es',
              slug: 'changed',
              title: 'Changed',
              description: null,
              status: 'published',
            },
          ],
          postIds: [],
        },
        vi.fn()
      )
    ).rejects.toThrow('collection-slug-locked');
    expect(
      await database
        .select({
          slug: schema.collectionLocalizations.slug,
          first: schema.collectionLocalizations.firstPublishedAt,
        })
        .from(schema.collectionLocalizations)
        .where(eq(schema.collectionLocalizations.id, localizationId))
    ).toEqual([{ slug: 'original', first: '2026-08-20 12:00:00' }]);
  });

  it('refuses in SQL when the collection is published between the check and the write', async () => {
    const database = db();
    const collectionId = crypto.randomUUID();
    const localizationId = crypto.randomUUID();
    const before = `antes-${collectionId}`;
    await database.insert(schema.collections).values({ id: collectionId });
    await database.insert(schema.collectionLocalizations).values({
      id: localizationId,
      collectionId,
      locale: 'es',
      slug: before,
      title: 'Antes',
      status: 'draft',
    });
    // The publish lands after saveCollection has read the row as unpublished,
    // so only the guard inside the batch stands between the rename and the
    // URL that is now public.
    const client = database.$client;
    const racing = new Proxy(database, {
      get(target, property, receiver) {
        if (property !== '$client') return Reflect.get(target, property, receiver);
        return {
          prepare: (query: string) => client.prepare(query),
          batch: async (statements: D1PreparedStatement[]) => {
            await client
              .prepare(
                `UPDATE collection_localizations SET status = 'published', first_published_at = '2026-08-22 09:00:00' WHERE id = ?`
              )
              .bind(localizationId)
              .run();
            return client.batch(statements);
          },
        };
      },
    });
    await expect(
      saveCollection(
        racing,
        {
          id: collectionId,
          editorialState: 'active',
          localizations: [
            {
              id: localizationId,
              locale: 'es',
              slug: `despues-${collectionId}`,
              title: 'Después',
              description: null,
              status: 'published',
            },
          ],
          postIds: [],
        },
        vi.fn().mockResolvedValue(undefined)
      )
    ).rejects.toThrow('collection-slug-locked');
    // Nothing from the refused batch survives, the title included.
    expect(
      await database
        .select({
          slug: schema.collectionLocalizations.slug,
          title: schema.collectionLocalizations.title,
        })
        .from(schema.collectionLocalizations)
        .where(eq(schema.collectionLocalizations.id, localizationId))
    ).toEqual([{ slug: before, title: 'Antes' }]);
  });
});

describe('featured posts and SEO', () => {
  it('keeps exactly one active published feature per locale and rejects drafts', async () => {
    const database = db();
    const first = await post(database, 'es');
    const second = await post(database, 'es');
    const draft = await post(database, 'en', 'draft');
    const purge = vi.fn().mockResolvedValue(undefined);
    await setFeaturedLocalization(
      database,
      { localizationId: first.localizationId, featured: true },
      purge
    );
    await setFeaturedLocalization(
      database,
      { localizationId: second.localizationId, featured: true },
      purge
    );
    const rows = await database
      .select({ id: schema.postLocalizations.id, featuredAt: schema.postLocalizations.featuredAt })
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.locale, 'es'));
    expect(rows.filter((row) => row.featuredAt !== null)).toEqual([
      { id: second.localizationId, featuredAt: expect.any(String) },
    ]);
    expect(await findFeaturedPost(database, 'es')).toMatchObject({ slug: `es-${second.postId}` });
    await expect(
      setFeaturedLocalization(
        database,
        { localizationId: draft.localizationId, featured: true },
        purge
      )
    ).rejects.toThrow('feature-not-publishable');
    expect(purge).toHaveBeenCalledWith(['featured']);
  });

  it('CAS-saves SEO plus cover and author without mutating a published revision', async () => {
    const database = db();
    const seeded = await post(database, 'es', 'draft');
    const coverMediaId = await media(database);
    const authorId = crypto.randomUUID();
    await database
      .insert(schema.authors)
      .values({ id: authorId, slug: `author-${authorId}`, name: 'Author' });
    const purge = vi.fn().mockResolvedValue(undefined);
    const input = {
      postId: seeded.postId,
      localizationId: seeded.localizationId,
      draftToken: null,
      nextToken: crypto.randomUUID(),
      seoTitle: 'SEO title',
      seoDescription: 'SEO description',
      ogTitle: 'OG title',
      ogDescription: 'OG description',
      ogImageMediaId: coverMediaId,
      ogImageAlt: 'Social card',
      coverMediaId,
      authorId,
    };
    await expect(saveSeoDraft(database, input, purge)).resolves.toMatchObject({
      draftToken: input.nextToken,
    });
    expect(await draftRow(database, seeded.localizationId)).toMatchObject([
      { seoTitle: 'SEO title', ogTitle: 'OG title', draftToken: input.nextToken },
    ]);
    expect(
      await database.select().from(schema.posts).where(eq(schema.posts.id, seeded.postId))
    ).toMatchObject([{ coverMediaId, authorId }]);
    expect(
      await database
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, seeded.localizationId))
    ).toEqual([]);
    // Another attempt that also believes no draft exists must not replace it.
    await expect(
      saveSeoDraft(database, { ...input, nextToken: crypto.randomUUID() }, purge)
    ).rejects.toThrow('draft-conflict');
  });

  it('accepts a seeded draft token and replays a lost response instead of conflicting', async () => {
    const database = db();
    const seeded = await post(database, 'es', 'draft');
    await database.insert(schema.postDrafts).values({
      postLocalizationId: seeded.localizationId,
      title: 'Semilla',
      contentJson: { type: 'doc', content: [] },
      draftToken: 'publish-token-seeded',
    });
    const purge = vi.fn().mockResolvedValue(undefined);
    const input = {
      ...noSeo,
      postId: seeded.postId,
      localizationId: seeded.localizationId,
      draftToken: 'publish-token-seeded',
      nextToken: crypto.randomUUID(),
      seoTitle: 'Título SEO',
    };
    await expect(saveSeoDraft(database, input, purge)).resolves.toEqual({
      status: 'saved',
      draftToken: input.nextToken,
    });
    // The first response was lost; the same attempt arrives again.
    await expect(saveSeoDraft(database, input, purge)).resolves.toEqual({
      status: 'saved',
      draftToken: input.nextToken,
    });
    expect(await draftRow(database, seeded.localizationId)).toMatchObject([
      { title: 'Semilla', seoTitle: 'Título SEO', draftToken: input.nextToken },
    ]);
  });

  it('never lets an SEO save and an autosave overwrite each other', async () => {
    const database = db();
    const seeded = await post(database, 'es', 'draft');
    const purge = vi.fn().mockResolvedValue(undefined);
    const edit = (draftToken: string | null, nextToken: string, title: string) =>
      saveDraft(database, {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        draftToken,
        nextToken,
        title,
        excerpt: null,
        contentJson: { type: 'doc', content: [] },
      });
    const seo = (draftToken: string, nextToken: string) =>
      saveSeoDraft(
        database,
        {
          ...noSeo,
          postId: seeded.postId,
          localizationId: seeded.localizationId,
          draftToken,
          nextToken,
          seoTitle: 'SEO',
        },
        purge
      );
    const loaded = crypto.randomUUID();
    const autosaved = crypto.randomUUID();
    const seoSaved = crypto.randomUUID();
    await edit(null, loaded, 'Editor');

    // Both tabs loaded `loaded`; the autosave lands first.
    await edit(loaded, autosaved, 'Editor 2');
    await expect(seo(loaded, crypto.randomUUID())).rejects.toThrow('draft-conflict');

    // Now the SEO form reloads and lands, and the editor still holds `autosaved`.
    await seo(autosaved, seoSaved);
    await expect(edit(autosaved, crypto.randomUUID(), 'Editor 3')).rejects.toThrow(
      'draft-conflict'
    );
    expect(await draftRow(database, seeded.localizationId)).toMatchObject([
      { title: 'Editor 2', seoTitle: 'SEO', draftToken: seoSaved },
    ]);
  });

  it('refuses to clear the cover while any localization of the post is published', async () => {
    const database = db();
    const live = await post(database, 'es');
    const coverMediaId = await media(database);
    await database
      .update(schema.posts)
      .set({ coverMediaId })
      .where(eq(schema.posts.id, live.postId));
    // The locale being edited is a draft; its published sibling is what makes
    // the cover required.
    const draftLocalizationId = crypto.randomUUID();
    await database.insert(schema.postLocalizations).values({
      id: draftLocalizationId,
      postId: live.postId,
      locale: 'en',
      slug: `en-${live.postId}`,
      status: 'draft',
    });
    await expect(
      saveSeoDraft(
        database,
        {
          ...noSeo,
          postId: live.postId,
          localizationId: draftLocalizationId,
          draftToken: null,
          nextToken: crypto.randomUUID(),
        },
        vi.fn().mockResolvedValue(undefined)
      )
    ).rejects.toThrow('cover-required-while-published');
    expect(
      await database
        .select({ coverMediaId: schema.posts.coverMediaId })
        .from(schema.posts)
        .where(eq(schema.posts.id, live.postId))
    ).toEqual([{ coverMediaId }]);
    expect(await draftRow(database, draftLocalizationId)).toEqual([]);
  });

  it('hydrates effective public metadata, social image fallback, clean cover, and author', async () => {
    const database = db();
    const postId = crypto.randomUUID();
    const localizationId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const coverMediaId = await media(database);
    const socialMediaId = await media(database);
    const authorId = crypto.randomUUID();
    await database.insert(schema.authors).values({
      id: authorId,
      slug: `cesco-${authorId}`,
      name: 'Cesco Valle',
      websiteUrl: 'https://example.com',
      sameAs: ['https://social.example/cesco'],
    });
    await database.insert(schema.posts).values({
      id: postId,
      section: 'analysis',
      authorId,
      coverMediaId,
    });
    await database.insert(schema.postLocalizations).values({
      id: localizationId,
      postId,
      locale: 'es',
      slug: 'metadata-publica',
      status: 'published',
      publishedRevisionId: revisionId,
      firstPublishedAt: '2026-08-20 12:00:00',
    });
    await database.insert(schema.postRevisions).values({
      id: revisionId,
      postLocalizationId: localizationId,
      version: 1,
      title: 'Título editorial',
      excerpt: 'Resumen editorial',
      contentJson: { type: 'doc', content: [] },
      seoDescription: 'Descripción SEO',
      ogTitle: 'Título OG',
      ogImageMediaId: socialMediaId,
      ogImageAlt: 'Tarjeta social',
    });
    const resolution = await resolveArticleUrl(database, {
      locale: 'es',
      section: 'analysis',
      slug: 'metadata-publica',
    });
    expect(resolution.kind).toBe('render');
    if (resolution.kind !== 'render') return;
    expect(resolution.post).toMatchObject({
      seo: {
        title: 'Título editorial',
        description: 'Descripción SEO',
        ogTitle: 'Título OG',
        ogDescription: 'Descripción SEO',
      },
      cover: { id: coverMediaId, width: 1200, height: 628 },
      socialImage: { id: socialMediaId, alt: 'Tarjeta social', width: 1200, height: 628 },
      author: {
        name: 'Cesco Valle',
        websiteUrl: 'https://example.com',
        sameAs: ['https://social.example/cesco'],
      },
    });
  });

  it('defers SEO-only purge until publish but invalidates live cover and author changes', async () => {
    const database = db();
    const seeded = await post(database, 'en');
    const originalCover = await media(database);
    await database
      .update(schema.posts)
      .set({ coverMediaId: originalCover })
      .where(eq(schema.posts.id, seeded.postId));
    const coverMediaId = await media(database);
    const authorId = crypto.randomUUID();
    await database
      .insert(schema.authors)
      .values({ id: authorId, slug: `live-${authorId}`, name: 'Live author' });
    const input = {
      ...noSeo,
      postId: seeded.postId,
      localizationId: seeded.localizationId,
      draftToken: null,
      nextToken: crypto.randomUUID(),
      seoTitle: 'Draft SEO',
      coverMediaId: originalCover,
    };
    const seoOnlyPurge = vi.fn().mockResolvedValue(undefined);
    await expect(saveSeoDraft(database, input, seoOnlyPurge)).resolves.toMatchObject({
      status: 'saved',
    });
    expect(seoOnlyPurge).not.toHaveBeenCalled();

    const surfacePurge = vi.fn().mockRejectedValue(Error('purge unavailable'));
    const surfaceToken = crypto.randomUUID();
    await expect(
      saveSeoDraft(
        database,
        {
          ...input,
          draftToken: input.nextToken,
          nextToken: surfaceToken,
          coverMediaId,
          authorId,
        },
        surfacePurge
      )
    ).resolves.toMatchObject({ status: 'saved-with-cache-warning', draftToken: surfaceToken });
    expect(surfacePurge).toHaveBeenCalledWith(
      expect.arrayContaining([`post-${seeded.postId}`, 'locale-en', 'featured', 'rss', 'sitemap'])
    );
  });
});
