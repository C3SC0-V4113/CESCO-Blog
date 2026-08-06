import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { schema } from '@/db/client';
import { resolveArticleUrl } from '@/db/queries/posts';
import { newPostRevisionId } from '@/lib/ids';

import { at, renameSlug, seedPost, testDb, withdraw } from './fixtures';

/**
 * The read path for the article detail page, and the URL lifecycle of ADR-0010
 * enforced against real D1.
 *
 * The unit tests cover the decision table in isolation. These cover the part
 * that only SQL can get wrong: which rows the three tables actually yield.
 */

const PUBLISHED = at('2026-03-01T09:00:00Z');
const ES_ANALYSIS = { locale: 'es', section: 'analysis' } as const;

describe('resolveArticleUrl', () => {
  it('renders a published localization', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'combate', title: 'El combate', publishedAt: PUBLISHED },
      ],
    });

    const resolution = await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'combate' });

    expect(resolution.kind).toBe('render');
    expect(resolution.kind === 'render' && resolution.post.title).toBe('El combate');
  });

  it('answers 404 for a localization that was never published', async () => {
    const db = testDb();
    await seedPost(db, { localizations: [{ locale: 'es', slug: 'borrador' }] });

    expect((await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'borrador' })).kind).toBe(
      'not-found'
    );
  });

  it('answers 410 once a published localization is withdrawn', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'retirado', publishedAt: PUBLISHED }],
    });
    await withdraw(db, seeded.localizations[0]!.id);

    expect((await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'retirado' })).kind).toBe('gone');
  });

  it('answers 410 for a globally archived post that was published', async () => {
    // `editorial_state` decides whether content is served. It must not decide
    // between 404 and 410 — this URL was public and indexed (ADR-0010).
    const db = testDb();
    await seedPost(db, {
      editorialState: 'archived',
      localizations: [{ locale: 'es', slug: 'archivado', publishedAt: PUBLISHED }],
    });

    expect((await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'archivado' })).kind).toBe('gone');
  });

  it('answers 404 for the never-published locale of an archived post', async () => {
    // The example ADR-0010 spells out: the same post answers 410 in Spanish and
    // 404 in English, because only one of the two was ever public.
    const db = testDb();
    await seedPost(db, {
      editorialState: 'archived',
      localizations: [
        { locale: 'es', slug: 'publicado-es', publishedAt: PUBLISHED },
        { locale: 'en', slug: 'never-published-en' },
      ],
    });

    expect((await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'publicado-es' })).kind).toBe(
      'gone'
    );
    expect(
      (
        await resolveArticleUrl(db, {
          locale: 'en',
          section: 'analysis',
          slug: 'never-published-en',
        })
      ).kind
    ).toBe('not-found');
  });

  it('redirects a retired slug to the current one', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'nombre-viejo', publishedAt: PUBLISHED }],
    });
    await renameSlug(db, seeded.localizations[0]!.id, 'es', 'nombre-viejo', 'nombre-nuevo');

    expect(await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'nombre-viejo' })).toEqual({
      kind: 'redirect',
      slug: 'nombre-nuevo',
    });
  });

  it('resolves a twice-renamed slug in a single hop', async () => {
    // ADR-0010 forbids redirect chains: renaming A→B→C must send A straight to
    // C, never to B. This is the case the fixture's history rewrite exists for.
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'nombre-a', publishedAt: PUBLISHED }],
    });
    const localizationId = seeded.localizations[0]!.id;

    await renameSlug(db, localizationId, 'es', 'nombre-a', 'nombre-b');
    await renameSlug(db, localizationId, 'es', 'nombre-b', 'nombre-c');

    expect(await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'nombre-a' })).toEqual({
      kind: 'redirect',
      slug: 'nombre-c',
    });
    expect(await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'nombre-b' })).toEqual({
      kind: 'redirect',
      slug: 'nombre-c',
    });
  });

  it('does not redirect across sections', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      section: 'analysis',
      localizations: [{ locale: 'es', slug: 'viejo-analisis', publishedAt: PUBLISHED }],
    });
    await renameSlug(db, seeded.localizations[0]!.id, 'es', 'viejo-analisis', 'nuevo-analisis');

    expect(
      (await resolveArticleUrl(db, { locale: 'es', section: 'opinion', slug: 'viejo-analisis' }))
        .kind
    ).toBe('not-found');
  });

  it('does not leak one locale into the other', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'solo-espanol', publishedAt: PUBLISHED },
        { locale: 'en', slug: 'english-only', publishedAt: PUBLISHED },
      ],
    });

    expect(
      (await resolveArticleUrl(db, { locale: 'en', section: 'analysis', slug: 'solo-espanol' }))
        .kind
    ).toBe('not-found');
  });

  it('does not serve an analysis from the opinion route', async () => {
    const db = testDb();
    await seedPost(db, {
      section: 'analysis',
      localizations: [{ locale: 'es', slug: 'ambiguo', publishedAt: PUBLISHED }],
    });

    expect(
      (await resolveArticleUrl(db, { locale: 'es', section: 'opinion', slug: 'ambiguo' })).kind
    ).toBe('not-found');
  });

  it('answers 404 for an unknown slug', async () => {
    const db = testDb();

    expect((await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'no-existe' })).kind).toBe(
      'not-found'
    );
  });

  it('serves the published revision rather than the newest one', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'revisado', title: 'Publicada', publishedAt: PUBLISHED },
      ],
    });

    await db.insert(schema.postRevisions).values({
      id: newPostRevisionId(),
      postLocalizationId: seeded.localizations[0]!.id,
      version: 2,
      title: 'Borrador posterior',
      contentJson: { type: 'doc', content: [] },
    });

    const resolution = await resolveArticleUrl(db, { ...ES_ANALYSIS, slug: 'revisado' });

    expect(resolution.kind === 'render' && resolution.post.title).toBe('Publicada');
  });
});

describe('resolveArticleUrl metadata', () => {
  async function postAt(db: ReturnType<typeof testDb>, slug: string) {
    const resolution = await resolveArticleUrl(db, { ...ES_ANALYSIS, slug });
    if (resolution.kind !== 'render') throw new Error(`expected a render, got ${resolution.kind}`);
    return resolution.post;
  }

  it('carries the byline, the derived fields and the section', async () => {
    const db = testDb();
    await seedPost(db, {
      withAuthor: true,
      localizations: [{ locale: 'es', slug: 'con-autor', publishedAt: PUBLISHED }],
    });

    const post = await postAt(db, 'con-autor');

    expect(post.authorName).toBe('Cesco Valle');
    expect(post.readingTimeMinutes).toBe(5);
    expect(post.section).toBe('analysis');
    // First publication, not the latest — the byline date must survive an
    // unpublish and republish cycle (ADR-0010).
    expect(post.publishedAt).toBe(PUBLISHED);
  });

  it('treats a missing table of contents as empty rather than an error', async () => {
    // Revisions written before the derivation existed have no TOC, and an
    // article with no headings correctly has nothing to list.
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'sin-toc', publishedAt: PUBLISHED }],
    });

    expect((await postAt(db, 'sin-toc')).toc).toEqual([]);
  });

  it('reads a stored table of contents', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'con-toc', publishedAt: PUBLISHED }],
    });

    await db
      .update(schema.postRevisions)
      .set({ tocJson: [{ id: 'bloque-1', level: 2, text: 'El combate' }] })
      .where(eq(schema.postRevisions.id, seeded.localizations[0]!.revisionId));

    expect((await postAt(db, 'con-toc')).toc).toEqual([
      { id: 'bloque-1', level: 2, text: 'El combate' },
    ]);
  });

  it('carries analysis metadata when the post has a row', async () => {
    const db = testDb();
    await seedPost(db, {
      reviewCopyFrom: 'Estudio Ejemplo',
      localizations: [{ locale: 'es', slug: 'con-copia', publishedAt: PUBLISHED }],
    });

    const post = await postAt(db, 'con-copia');

    expect(post.analysis?.receivedReviewCopy).toBe(true);
    expect(post.analysis?.reviewCopyProvider).toBe('Estudio Ejemplo');
  });

  it('reports no analysis metadata when the post has no row', async () => {
    // The distinction that matters: "there is no metadata" is not the same as
    // "the metadata says no review copy", and only the second should render a
    // disclosure decision either way.
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'sin-metadata', publishedAt: PUBLISHED }],
    });

    expect((await postAt(db, 'sin-metadata')).analysis).toBeNull();
  });

  it('leaves the author null when the post has none', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'sin-autor', publishedAt: PUBLISHED }],
    });

    expect((await postAt(db, 'sin-autor')).authorName).toBeNull();
  });
});
