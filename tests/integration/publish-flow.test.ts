import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import {
  publicationErrorCode,
  publishLocalization,
  renameLocalizationSlug,
  retryPublicationPurge,
  unpublishLocalization,
} from '@/actions/publishing';
import { createDb, schema } from '@/db/client';

import type { ContentDoc } from '@/lib/content/schema';

const ids = () => ({
  postId: crypto.randomUUID(),
  localizationId: crypto.randomUUID(),
  coverId: crypto.randomUUID(),
  inlineId: crypto.randomUUID(),
});
const now = new Date('2026-08-14T12:30:00Z');
const doc = (inlineId: string): ContentDoc => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { blockId: 'heading', level: 2 },
      content: [{ type: 'text', text: 'Encabezado' }],
    },
    {
      type: 'codeBlock',
      attrs: { blockId: 'code', language: 'javascript' },
      content: [{ type: 'text', text: 'const answer = 42;' }],
    },
    {
      type: 'image',
      attrs: { blockId: 'image', mediaAssetId: inlineId, alt: 'Detalle' },
    },
  ],
});

async function seedDraft(overrides: { cover?: boolean; title?: string } = {}) {
  const db = createDb(env.DB);
  const value = ids();
  await db.insert(schema.mediaAssets).values([
    {
      id: value.coverId,
      r2Key: `media/2026/08/${value.coverId}.webp`,
      contentType: 'image/webp',
      width: 1200,
      height: 630,
    },
    {
      id: value.inlineId,
      r2Key: `media/2026/08/${value.inlineId}.webp`,
      contentType: 'image/webp',
      width: 800,
      height: 600,
      caption: 'Pie original',
      creatorName: 'Autora original',
      sourceUrl: 'https://example.com/original',
      licenseLabel: 'Licencia original',
      licenseUrl: 'https://example.com/license',
    },
  ]);
  await db.insert(schema.posts).values({
    id: value.postId,
    section: 'analysis',
    coverMediaId: overrides.cover === false ? null : value.coverId,
  });
  await db.insert(schema.postLocalizations).values({
    id: value.localizationId,
    postId: value.postId,
    locale: 'es',
    slug: `slug-${value.postId}`,
  });
  await db.insert(schema.postDrafts).values({
    postLocalizationId: value.localizationId,
    title: overrides.title ?? 'Publicable',
    excerpt: 'Resumen',
    contentJson: doc(value.inlineId),
    seoTitle: 'SEO preservado',
    ogTitle: 'OG preservado',
    draftToken: 'reviewed-token',
  });
  return { db, ...value };
}

describe('publish flow', () => {
  it('maps unsafe media URLs to a deterministic action client error', () => {
    expect(publicationErrorCode(Error('media-url-invalid'))).toBe('BAD_REQUEST');
    expect(publicationErrorCode(Error('redirect-acknowledgement-required'))).toBe('BAD_REQUEST');
    expect(publicationErrorCode(Error('too-many-highlight-languages'))).toBe('BAD_REQUEST');
  });

  it('commits one immutable revision before reporting and recovering a purge warning', async () => {
    const seeded = await seedDraft();
    const operationId = crypto.randomUUID();
    const failingPurge = vi.fn().mockRejectedValue(Error('purge unavailable'));
    const input = {
      postId: seeded.postId,
      localizationId: seeded.localizationId,
      draftToken: 'reviewed-token',
      operationId,
    };
    await expect(publishLocalization(seeded.db, input, failingPurge, now)).resolves.toMatchObject({
      status: 'published-with-cache-warning',
      revisionId: operationId,
    });
    const [revision] = await seeded.db
      .select()
      .from(schema.postRevisions)
      .where(eq(schema.postRevisions.id, operationId));
    expect(revision).toMatchObject({
      version: 1,
      seoTitle: 'SEO preservado',
      ogTitle: 'OG preservado',
      readingTimeMinutes: 1,
      tocJson: [{ id: 'heading', level: 2, text: 'Encabezado' }],
    });
    expect(await seeded.db.select().from(schema.postRevisionMedia)).toMatchObject([
      { revisionId: operationId, mediaAssetId: seeded.inlineId, blockId: 'image', position: 2 },
    ]);
    expect(
      await seeded.db
        .select()
        .from(schema.postDrafts)
        .where(eq(schema.postDrafts.postLocalizationId, seeded.localizationId))
    ).toMatchObject([{ draftToken: 'reviewed-token', title: 'Publicable' }]);
    const purge = vi.fn().mockResolvedValue(undefined);
    await expect(retryPublicationPurge(seeded.db, input, purge)).resolves.toEqual({
      status: 'published',
      revisionId: operationId,
    });
    await expect(publishLocalization(seeded.db, input, purge, now)).resolves.toMatchObject({
      status: 'published',
      revisionId: operationId,
    });
    expect(
      await seeded.db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, seeded.localizationId))
    ).toHaveLength(1);
    expect(purge).toHaveBeenCalledWith([
      `post-${seeded.postId}`,
      'section-analysis',
      'locale-es',
      'rss',
      'sitemap',
    ]);
  });

  it('republishes, preserves publication history, and unpublishes without deleting drafts', async () => {
    const seeded = await seedDraft();
    const purge = vi.fn().mockResolvedValue(undefined);
    const first = crypto.randomUUID();
    await publishLocalization(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        draftToken: 'reviewed-token',
        operationId: first,
      },
      purge,
      now
    );
    await seeded.db
      .update(schema.postDrafts)
      .set({ title: 'Segunda versiÃ³n', draftToken: 'token-2' })
      .where(eq(schema.postDrafts.postLocalizationId, seeded.localizationId));
    const second = crypto.randomUUID();
    await publishLocalization(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        draftToken: 'token-2',
        operationId: second,
      },
      purge,
      new Date('2026-08-15T09:00:00Z')
    );
    expect(
      await seeded.db
        .select({ id: schema.postRevisions.id, version: schema.postRevisions.version })
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, seeded.localizationId))
    ).toEqual([
      { id: first, version: 1 },
      { id: second, version: 2 },
    ]);
    const [localization] = await seeded.db
      .select()
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.id, seeded.localizationId));
    expect(localization).toMatchObject({
      status: 'published',
      publishedRevisionId: second,
      firstPublishedAt: '2026-08-14 12:30:00',
      currentPublishedAt: '2026-08-15 09:00:00',
    });
    await unpublishLocalization(
      seeded.db,
      { postId: seeded.postId, localizationId: seeded.localizationId },
      purge
    );
    expect(
      await seeded.db
        .select()
        .from(schema.postLocalizations)
        .where(eq(schema.postLocalizations.id, seeded.localizationId))
    ).toMatchObject([
      {
        status: 'draft',
        publishedRevisionId: null,
        firstPublishedAt: '2026-08-14 12:30:00',
        currentPublishedAt: '2026-08-15 09:00:00',
      },
    ]);
    expect(
      await seeded.db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, seeded.localizationId))
    ).toHaveLength(2);
    expect(
      await seeded.db
        .select()
        .from(schema.postDrafts)
        .where(eq(schema.postDrafts.postLocalizationId, seeded.localizationId))
    ).toHaveLength(1);

    await publishLocalization(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        draftToken: 'token-2',
        operationId: crypto.randomUUID(),
      },
      purge,
      new Date('2026-08-16T09:00:00Z')
    );
    expect(
      await seeded.db
        .select({
          first: schema.postLocalizations.firstPublishedAt,
          current: schema.postLocalizations.currentPublishedAt,
        })
        .from(schema.postLocalizations)
        .where(eq(schema.postLocalizations.id, seeded.localizationId))
    ).toEqual([{ first: '2026-08-14 12:30:00', current: '2026-08-16 09:00:00' }]);
  });

  it('snapshots public media metadata and accepts a 100-image document within the query budget', async () => {
    const seeded = await seedDraft();
    const images = Array.from({ length: 100 }, (_, index) => ({
      id: crypto.randomUUID(),
      blockId: `image-${index}`,
    }));
    const assetRows = images.map(({ id }, index) => ({
      id,
      r2Key: `media/2026/08/${id}.webp`,
      contentType: 'image/webp',
      width: 20 + index,
      height: 10,
      caption: `Pie ${index}`,
      creatorName: `Autora ${index}`,
      sourceUrl: `https://example.com/source/${index}`,
      licenseLabel: `Licencia ${index}`,
      licenseUrl: `https://example.com/license/${index}`,
    }));
    for (let start = 0; start < assetRows.length; start += 5)
      await seeded.db.insert(schema.mediaAssets).values(assetRows.slice(start, start + 5));
    await seeded.db
      .update(schema.postDrafts)
      .set({
        contentJson: {
          type: 'doc',
          content: images.map(({ id, blockId }) => ({
            type: 'image',
            attrs: { blockId, mediaAssetId: id, alt: `Alt ${blockId}` },
          })),
        },
      })
      .where(eq(schema.postDrafts.postLocalizationId, seeded.localizationId));
    const revisionId = crypto.randomUUID();
    const originalBatch = seeded.db.$client.batch.bind(seeded.db.$client);
    const batchSizes: number[] = [];
    Object.defineProperty(seeded.db.$client, 'batch', {
      configurable: true,
      value: async (statements: Parameters<typeof originalBatch>[0]) => {
        batchSizes.push(statements.length);
        return originalBatch(statements);
      },
    });
    const purge = vi.fn().mockResolvedValue(undefined);
    await expect(
      publishLocalization(
        seeded.db,
        {
          postId: seeded.postId,
          localizationId: seeded.localizationId,
          draftToken: 'reviewed-token',
          operationId: revisionId,
        },
        purge,
        now
      )
    ).resolves.toMatchObject({ status: 'published' });
    expect(batchSizes).toEqual([3]);
    expect(
      await seeded.db
        .select()
        .from(schema.postRevisionMedia)
        .where(eq(schema.postRevisionMedia.revisionId, revisionId))
    ).toHaveLength(100);

    await seeded.db
      .update(schema.mediaAssets)
      .set({
        caption: 'Mutado',
        creatorName: 'Mutada',
        sourceUrl: 'https://evil.example',
        licenseLabel: 'Mutada',
      })
      .where(eq(schema.mediaAssets.id, images[0]!.id));
    const { resolveArticleUrl } = await import('@/db/queries/posts');
    const resolution = await resolveArticleUrl(seeded.db, {
      locale: 'es',
      section: 'analysis',
      slug: `slug-${seeded.postId}`,
    });
    expect(resolution.kind).toBe('render');
    expect(resolution.kind === 'render' && resolution.post.media[0]).toMatchObject({
      caption: 'Pie 0',
      credit: 'Autora 0',
      sourceUrl: 'https://example.com/source/0',
      licenseLabel: 'Licencia 0',
    });
    expect(resolution.kind === 'render' && resolution.post.updatedAt).toBe('2026-08-14 12:30:00');
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('rejects stale, invalid, missing-cover, missing-media, and concurrent publication atomically', async () => {
    const purge = vi.fn().mockResolvedValue(undefined);
    const noCover = await seedDraft({ cover: false });
    await expect(
      publishLocalization(
        noCover.db,
        {
          postId: noCover.postId,
          localizationId: noCover.localizationId,
          draftToken: 'reviewed-token',
          operationId: crypto.randomUUID(),
        },
        purge,
        now
      )
    ).rejects.toThrow('cover-required');
    const seeded = await seedDraft();
    await seeded.db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, seeded.inlineId));
    await expect(
      publishLocalization(
        seeded.db,
        {
          postId: seeded.postId,
          localizationId: seeded.localizationId,
          draftToken: 'stale',
          operationId: crypto.randomUUID(),
        },
        purge,
        now
      )
    ).rejects.toThrow('draft-conflict');
    await expect(
      publishLocalization(
        seeded.db,
        {
          postId: seeded.postId,
          localizationId: seeded.localizationId,
          draftToken: 'reviewed-token',
          operationId: crypto.randomUUID(),
        },
        purge,
        now
      )
    ).rejects.toThrow('media-missing');
    expect(
      await seeded.db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, seeded.localizationId))
    ).toEqual([]);
    expect(purge).not.toHaveBeenCalled();

    const unsafe = await seedDraft();
    await unsafe.db
      .update(schema.mediaAssets)
      .set({ sourceUrl: 'javascript:alert(1)', licenseUrl: 'data:text/html,unsafe' })
      .where(eq(schema.mediaAssets.id, unsafe.inlineId));
    await expect(
      publishLocalization(
        unsafe.db,
        {
          postId: unsafe.postId,
          localizationId: unsafe.localizationId,
          draftToken: 'reviewed-token',
          operationId: crypto.randomUUID(),
        },
        purge,
        now
      )
    ).rejects.toThrow('media-url-invalid');
    expect(
      await unsafe.db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, unsafe.localizationId))
    ).toEqual([]);

    const concurrent = await seedDraft();
    const attempts = await Promise.allSettled(
      [crypto.randomUUID(), crypto.randomUUID()].map((operationId) =>
        publishLocalization(
          concurrent.db,
          {
            postId: concurrent.postId,
            localizationId: concurrent.localizationId,
            draftToken: 'reviewed-token',
            operationId,
          },
          purge,
          now
        )
      )
    );
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(
      await concurrent.db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, concurrent.localizationId))
    ).toHaveLength(1);
  });

  it('reserves renamed slugs permanently and resolves A to C through one localization', async () => {
    const seeded = await seedDraft();
    const purge = vi.fn().mockResolvedValue(undefined);
    await renameLocalizationSlug(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        slug: 'b',
        acknowledgePermanentRedirect: false,
      } as never,
      purge
    );
    expect(await seeded.db.select().from(schema.postLocalizationSlugHistory)).toEqual([]);
    await seeded.db
      .update(schema.postLocalizations)
      .set({ firstPublishedAt: '2026-08-14 12:30:00' })
      .where(eq(schema.postLocalizations.id, seeded.localizationId));
    await expect(
      renameLocalizationSlug(
        seeded.db,
        {
          postId: seeded.postId,
          localizationId: seeded.localizationId,
          slug: 'c',
          acknowledgePermanentRedirect: false,
        } as never,
        purge
      )
    ).rejects.toThrow('redirect-acknowledgement-required');
    await expect(
      renameLocalizationSlug(
        seeded.db,
        { postId: seeded.postId, localizationId: seeded.localizationId, slug: 'c' } as never,
        purge
      )
    ).rejects.toThrow();
    await renameLocalizationSlug(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        slug: 'c',
        acknowledgePermanentRedirect: true,
      } as never,
      purge
    );
    expect(await seeded.db.select().from(schema.postLocalizationSlugHistory)).toMatchObject([
      { postLocalizationId: seeded.localizationId, oldSlug: 'b' },
    ]);
    const other = await seedDraft();
    await expect(
      renameLocalizationSlug(
        other.db,
        {
          postId: other.postId,
          localizationId: other.localizationId,
          slug: 'b',
          acknowledgePermanentRedirect: false,
        } as never,
        purge
      )
    ).rejects.toThrow('slug-reserved');
    expect(
      await other.db
        .select({ slug: schema.postLocalizations.slug })
        .from(schema.postLocalizations)
        .where(
          and(
            eq(schema.postLocalizations.id, other.localizationId),
            eq(schema.postLocalizations.postId, other.postId)
          )
        )
    ).toEqual([{ slug: `slug-${other.postId}` }]);
  });

  it('records history when publication wins between rename read and transaction', async () => {
    const seeded = await seedDraft();
    const originalBatch = seeded.db.$client.batch.bind(seeded.db.$client);
    let interleaved = false;
    Object.defineProperty(seeded.db.$client, 'batch', {
      configurable: true,
      value: async (statements: Parameters<typeof originalBatch>[0]) => {
        if (!interleaved) {
          interleaved = true;
          await seeded.db
            .update(schema.postLocalizations)
            .set({ firstPublishedAt: '2026-08-14 12:30:00' })
            .where(eq(schema.postLocalizations.id, seeded.localizationId));
        }
        return originalBatch(statements);
      },
    });
    await renameLocalizationSlug(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        slug: 'after-publish',
        acknowledgePermanentRedirect: false,
      } as never,
      vi.fn().mockResolvedValue(undefined)
    ).then(
      () => {
        throw Error('expected acknowledgement rejection');
      },
      (error: unknown) => expect(error).toEqual(Error('redirect-acknowledgement-required'))
    );
    await renameLocalizationSlug(
      seeded.db,
      {
        postId: seeded.postId,
        localizationId: seeded.localizationId,
        slug: 'after-publish',
        acknowledgePermanentRedirect: true,
      } as never,
      vi.fn().mockResolvedValue(undefined)
    );
    expect(
      await seeded.db
        .select()
        .from(schema.postLocalizationSlugHistory)
        .where(eq(schema.postLocalizationSlugHistory.postLocalizationId, seeded.localizationId))
    ).toEqual([expect.objectContaining({ oldSlug: `slug-${seeded.postId}` })]);
  });
});
