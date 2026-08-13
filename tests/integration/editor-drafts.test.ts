import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { saveDraft } from '@/actions/drafts';
import { createDb, schema } from '@/db/client';
import { loadEditorDraft, loadEditorLocalizations } from '@/db/queries/editor-drafts';
import { newPostId, newPostLocalizationId, newPostRevisionId } from '@/lib/ids';

import type { ContentDoc } from '@/lib/content/schema';

const doc: ContentDoc = { type: 'doc', content: [] };
describe('editor drafts', () => {
  it('loads draft, published clone, then empty document without losing metadata', async () => {
    const db = createDb(env.DB);
    const postId = newPostId(),
      localizationId = newPostLocalizationId();
    await db.insert(schema.posts).values({ id: postId, section: 'analysis' });
    await db
      .insert(schema.postLocalizations)
      .values({ id: localizationId, postId, locale: 'es', slug: 'editor' });
    expect(await loadEditorLocalizations(db, postId)).toEqual({ es: localizationId });
    expect(await loadEditorDraft(db, postId, localizationId)).toMatchObject({
      title: '',
      contentJson: doc,
    });
    const mediaId = crypto.randomUUID();
    await db
      .insert(schema.mediaAssets)
      .values({ id: mediaId, r2Key: `og/${mediaId}`, contentType: 'image/webp' });
    const metadata = {
      seoTitle: 'SEO',
      seoDescription: 'Descripción',
      canonicalUrl: 'https://example.com/editor',
      ogTitle: 'OG',
      ogDescription: 'Vista previa',
      ogImageMediaId: mediaId,
      ogImageAlt: 'Alternativo',
    };
    const revisionId = newPostRevisionId();
    await db.insert(schema.postRevisions).values({
      id: revisionId,
      postLocalizationId: localizationId,
      version: 1,
      title: 'Publicada',
      excerpt: 'Resumen',
      contentJson: doc,
      ...metadata,
    });
    await db
      .update(schema.postLocalizations)
      .set({ publishedRevisionId: revisionId })
      .where(eq(schema.postLocalizations.id, localizationId));
    expect(await loadEditorDraft(db, postId, localizationId)).toMatchObject({
      title: 'Publicada',
      ...metadata,
    });
    await saveDraft(
      db,
      {
        postId,
        localizationId,
        draftToken: null,
        title: 'Cambio',
        excerpt: null,
        contentJson: doc,
      },
      'clone-token'
    );
    expect(
      await db
        .select()
        .from(schema.postDrafts)
        .where(eq(schema.postDrafts.postLocalizationId, localizationId))
    ).toMatchObject([metadata]);
    expect(await loadEditorDraft(db, postId, localizationId)).toMatchObject({ title: 'Cambio' });
  });

  it('saves with CAS, rejects invalid or cross-post writes, and creates no revisions', async () => {
    const db = createDb(env.DB);
    const postId = newPostId(),
      localizationId = newPostLocalizationId();
    await db.insert(schema.posts).values({ id: postId, section: 'opinion' });
    await db
      .insert(schema.postLocalizations)
      .values({ id: localizationId, postId, locale: 'en', slug: 'draft' });
    const input = {
      postId,
      localizationId,
      draftToken: null,
      title: 'Title',
      excerpt: null,
      contentJson: doc,
    };
    const first = await saveDraft(db, input, 'token-1');
    expect(first).toEqual({ draftToken: 'token-1' });
    expect(
      await saveDraft(db, { ...input, draftToken: 'token-1', title: 'Updated' }, 'token-2')
    ).toEqual({ draftToken: 'token-2' });
    await expect(saveDraft(db, { ...input, draftToken: 'token-1' }, 'stale')).rejects.toThrow(
      'draft-conflict'
    );
    await expect(
      saveDraft(db, { ...input, postId: newPostId(), draftToken: 'token-1' }, 'token-3')
    ).rejects.toThrow('draft-not-found');
    await expect(
      saveDraft(
        db,
        { ...input, contentJson: { type: 'doc', content: [{ type: 'image' }] } } as never,
        'token-4'
      )
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, localizationId))
    ).toEqual([]);
    expect(await db.select().from(schema.postRevisionMedia)).toEqual([]);
  });
});
