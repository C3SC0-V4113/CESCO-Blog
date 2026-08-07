import { beforeEach, describe, expect, it } from 'vitest';

import { listCollectionPosts, resolveCollectionUrl } from '@/db/queries/collections';

import { at, resetContent, seedCollection, seedPost, testDb } from './fixtures';

/**
 * Series (ADR-0012), and the proof that ADR-0010's URL lifecycle really is
 * entity-agnostic rather than something posts got and collections did not.
 */

const PUBLISHED = at('2026-04-01T10:00:00Z');

beforeEach(async () => {
  await resetContent(testDb());
});

describe('resolveCollectionUrl', () => {
  it('renders a published series', async () => {
    const db = testDb();
    await seedCollection(db, {
      locale: 'es',
      slug: 'saga',
      title: 'La saga',
      publishedAt: PUBLISHED,
    });

    const resolution = await resolveCollectionUrl(db, { locale: 'es', slug: 'saga' });

    expect(resolution.kind).toBe('render');
    expect(resolution.kind === 'render' && resolution.collection.title).toBe('La saga');
  });

  it('answers 410 for a withdrawn series, exactly like a withdrawn article', async () => {
    // ADR-0010:74 — "a withdrawn series URL behaves like a withdrawn article
    // URL". Same rule, same shared resolver.
    const db = testDb();
    await seedCollection(db, {
      locale: 'es',
      slug: 'retirada',
      publishedAt: PUBLISHED,
      withdrawn: true,
    });

    expect((await resolveCollectionUrl(db, { locale: 'es', slug: 'retirada' })).kind).toBe('gone');
  });

  it('answers 404 for a series that was never published', async () => {
    const db = testDb();
    await seedCollection(db, { locale: 'es', slug: 'borrador' });

    expect((await resolveCollectionUrl(db, { locale: 'es', slug: 'borrador' })).kind).toBe(
      'not-found'
    );
  });

  it('answers 410 for an archived series that was once public', async () => {
    // The aggregate switch decides whether it is served, never whether the URL
    // once existed.
    const db = testDb();
    await seedCollection(db, {
      locale: 'es',
      slug: 'archivada',
      publishedAt: PUBLISHED,
      editorialState: 'archived',
    });

    expect((await resolveCollectionUrl(db, { locale: 'es', slug: 'archivada' })).kind).toBe('gone');
  });

  it('answers 404 for an unknown slug', async () => {
    expect((await resolveCollectionUrl(testDb(), { locale: 'es', slug: 'nada' })).kind).toBe(
      'not-found'
    );
  });
});

describe('listCollectionPosts', () => {
  it('keeps the authored order rather than the chronological one', async () => {
    // The only thing that makes a series a series. Sorting by date would
    // silently turn it into a tag (ADR-0012).
    const db = testDb();
    const first = await seedPost(db, {
      localizations: [
        {
          locale: 'es',
          slug: 'parte-1',
          title: 'Parte 1',
          publishedAt: at('2026-03-01T10:00:00Z'),
        },
      ],
    });
    const second = await seedPost(db, {
      localizations: [
        {
          locale: 'es',
          slug: 'parte-2',
          title: 'Parte 2',
          publishedAt: at('2026-01-01T10:00:00Z'),
        },
      ],
    });

    // Deliberately authored newest-first, against publication order.
    const collectionId = await seedCollection(db, {
      locale: 'es',
      slug: 'saga',
      publishedAt: PUBLISHED,
      postIds: [first.postId, second.postId],
    });

    const posts = await listCollectionPosts(db, collectionId, 'es');

    expect(posts.map((p) => p.slug)).toEqual(['parte-1', 'parte-2']);
  });

  it('excludes members that are not servable in this locale', async () => {
    const db = testDb();
    const draft = await seedPost(db, { localizations: [{ locale: 'es', slug: 'borrador' }] });
    const live = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'publicado', publishedAt: PUBLISHED }],
    });

    const collectionId = await seedCollection(db, {
      locale: 'es',
      slug: 'saga',
      publishedAt: PUBLISHED,
      postIds: [draft.postId, live.postId],
    });

    expect((await listCollectionPosts(db, collectionId, 'es')).map((p) => p.slug)).toEqual([
      'publicado',
    ]);
  });
});
