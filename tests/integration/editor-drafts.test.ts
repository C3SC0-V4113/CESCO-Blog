import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { saveDraft } from '@/actions/drafts';
import { createDb, schema, type Db } from '@/db/client';
import { loadEditorDraft, loadEditorLocalizations } from '@/db/queries/editor-drafts';
import { newPostId, newPostLocalizationId, newPostRevisionId } from '@/lib/ids';

import type { ContentDoc } from '@/lib/content/schema';

const doc: ContentDoc = { type: 'doc', content: [] };
const token = () => crypto.randomUUID();

// Records every statement the driver prepares, so a test can pin down what a
// save reads and not only what it returns.
function recordingDb() {
  const statements: string[] = [];
  const binding = new Proxy(env.DB, {
    get(target, key) {
      if (key === 'prepare')
        return (query: string) => {
          statements.push(query);
          return target.prepare(query);
        };
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { db: createDb(binding), statements };
}

async function createLocalization(db: Db) {
  const postId = newPostId(),
    localizationId = newPostLocalizationId();
  await db.insert(schema.posts).values({ id: postId, section: 'opinion' });
  await db
    .insert(schema.postLocalizations)
    .values({ id: localizationId, postId, locale: 'en', slug: `draft-${localizationId}` });
  const input = { postId, localizationId, title: 'Title', excerpt: null, contentJson: doc };
  return { postId, localizationId, input };
}

async function storedDraft(db: Db, localizationId: string) {
  const [row] = await db
    .select({ title: schema.postDrafts.title, draftToken: schema.postDrafts.draftToken })
    .from(schema.postDrafts)
    .where(eq(schema.postDrafts.postLocalizationId, localizationId));
  return row;
}

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
    await saveDraft(db, {
      postId,
      localizationId,
      draftToken: null,
      nextToken: token(),
      title: 'Cambio',
      excerpt: null,
      contentJson: doc,
    });
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
    const { localizationId, input } = await createLocalization(db);
    const first = token(),
      second = token();
    expect(await saveDraft(db, { ...input, draftToken: null, nextToken: first })).toEqual({
      draftToken: first,
    });
    await expect(saveDraft(db, { ...input, draftToken: null, nextToken: token() })).rejects.toThrow(
      'draft-conflict'
    );
    expect(
      await saveDraft(db, { ...input, draftToken: first, nextToken: second, title: 'Updated' })
    ).toEqual({ draftToken: second });
    await expect(
      saveDraft(db, { ...input, draftToken: first, nextToken: token() })
    ).rejects.toThrow('draft-conflict');
    // The current token proves nothing about ownership: the post/localization
    // pair must be checked before compare-and-swap could accept the write.
    await expect(
      saveDraft(db, { ...input, postId: newPostId(), draftToken: second, nextToken: token() })
    ).rejects.toThrow('draft-not-found');
    await expect(
      saveDraft(db, { ...input, postId: newPostId(), draftToken: null, nextToken: token() })
    ).rejects.toThrow('draft-not-found');
    // Drafts hold image blocks: they name an asset and carry its alt text.
    const third = token();
    expect(
      await saveDraft(db, {
        ...input,
        draftToken: second,
        nextToken: third,
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'image',
              attrs: { blockId: crypto.randomUUID(), mediaAssetId: crypto.randomUUID(), alt: '' },
            },
          ],
        },
      })
    ).toEqual({ draftToken: third });
    const malformedImage = saveDraft(db, {
      ...input,
      draftToken: third,
      nextToken: token(),
      contentJson: {
        type: 'doc',
        content: [{ type: 'image', attrs: { blockId: 'b1', mediaAssetId: 'm1' } }],
      },
    } as never);
    await expect(malformedImage).rejects.toBeInstanceOf(ZodError);
    await expect(malformedImage).rejects.toMatchObject({
      issues: [{ path: ['contentJson', 'content', 0, 'attrs', 'alt'] }],
    });
    const heading = saveDraft(db, {
      ...input,
      draftToken: third,
      nextToken: token(),
      contentJson: {
        type: 'doc',
        content: [{ type: 'heading', attrs: { blockId: 'h1', level: 1 }, content: [] }],
      },
    });
    await expect(heading).rejects.toMatchObject({
      issues: [{ code: 'custom', path: ['contentJson'] }],
    });
    await expect(
      saveDraft(db, { ...input, draftToken: third, nextToken: 'not-a-uuid' })
    ).rejects.toMatchObject({ issues: [{ path: ['nextToken'] }] });
    expect(await storedDraft(db, localizationId)).toEqual({
      title: 'Title',
      draftToken: third,
    });
    expect(
      await db
        .select()
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.postLocalizationId, localizationId))
    ).toEqual([]);
    expect(await db.select().from(schema.postRevisionMedia)).toEqual([]);
  });

  it('replays an attempt whose response was lost and still rejects a stale client', async () => {
    const db = createDb(env.DB);
    const { localizationId, input } = await createLocalization(db);
    const a = token(),
      b = token(),
      c = token();
    await saveDraft(db, { ...input, draftToken: null, nextToken: a });
    await expect(saveDraft(db, { ...input, draftToken: null, nextToken: a })).resolves.toEqual({
      draftToken: a,
    });
    await expect(saveDraft(db, { ...input, draftToken: a, nextToken: b })).resolves.toEqual({
      draftToken: b,
    });
    await expect(saveDraft(db, { ...input, draftToken: a, nextToken: b })).resolves.toEqual({
      draftToken: b,
    });
    expect(await storedDraft(db, localizationId)).toMatchObject({ draftToken: b });
    await expect(saveDraft(db, { ...input, draftToken: a, nextToken: c })).rejects.toThrow(
      'draft-conflict'
    );
    await expect(saveDraft(db, { ...input, draftToken: null, nextToken: a })).rejects.toThrow(
      'draft-conflict'
    );
    expect(await storedDraft(db, localizationId)).toMatchObject({ draftToken: b });
  });

  it('reads only the published SEO fields on insert and no revision on update', async () => {
    const { db, statements } = recordingDb();
    const { localizationId, input } = await createLocalization(db);
    const revisionId = newPostRevisionId();
    await db.insert(schema.postRevisions).values({
      id: revisionId,
      postLocalizationId: localizationId,
      version: 1,
      title: 'Published',
      contentJson: doc,
      seoTitle: 'Published SEO',
    });
    await db
      .update(schema.postLocalizations)
      .set({ publishedRevisionId: revisionId })
      .where(eq(schema.postLocalizations.id, localizationId));
    const first = token();
    statements.length = 0;
    await saveDraft(db, { ...input, draftToken: null, nextToken: first });
    const reads = statements.filter((statement) => statement.startsWith('select'));
    expect(reads.join('\n')).toContain('"post_revisions"');
    expect(reads.join('\n')).not.toContain('"content_json"');
    statements.length = 0;
    await saveDraft(db, { ...input, draftToken: first, nextToken: token(), title: 'Again' });
    expect(statements).not.toHaveLength(0);
    expect(statements.join('\n')).not.toContain('post_revisions');
  });
});
