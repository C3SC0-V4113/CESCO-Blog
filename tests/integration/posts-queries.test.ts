import { describe, expect, it } from 'vitest';

import { schema } from '@/db/client';
import { getPublishedPost } from '@/db/queries/posts';
import { newPostRevisionId } from '@/lib/ids';

import { at, seedPost, testDb, withdraw } from './fixtures';

/**
 * The read path for the article detail page.
 *
 * Every case here is a way a URL can exist without being servable: a draft, a
 * globally archived post, the wrong locale, the wrong section. ADR-0010 governs
 * what the *response* should be; this query only decides whether there is
 * anything to render at all. The 404/410 distinction lands with the URL
 * lifecycle resolver.
 */

const PUBLISHED = at('2026-03-01T09:00:00Z');

describe('getPublishedPost', () => {
  it('returns a published localization', async () => {
    const db = testDb();
    await seedPost(db, {
      section: 'analysis',
      localizations: [
        { locale: 'es', slug: 'combate', title: 'El combate', publishedAt: PUBLISHED },
      ],
    });

    const post = await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'combate' });

    expect(post?.title).toBe('El combate');
    expect(post?.content).toEqual({ type: 'doc', content: [] });
  });

  it('returns null for a draft localization', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'borrador' }],
    });

    expect(
      await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'borrador' })
    ).toBeNull();
  });

  it('returns null once a published localization is withdrawn', async () => {
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'retirado', publishedAt: PUBLISHED }],
    });
    await withdraw(db, seeded.localizations[0]!.id);

    expect(
      await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'retirado' })
    ).toBeNull();
  });

  it('returns null when the post is globally archived', async () => {
    // ADR-0009: the aggregate switch overrides a published localization.
    const db = testDb();
    await seedPost(db, {
      editorialState: 'archived',
      localizations: [{ locale: 'es', slug: 'archivado', publishedAt: PUBLISHED }],
    });

    expect(
      await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'archivado' })
    ).toBeNull();
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
      await getPublishedPost(db, { locale: 'en', section: 'analysis', slug: 'solo-espanol' })
    ).toBeNull();
    expect(
      await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'english-only' })
    ).toBeNull();
  });

  it('does not serve an analysis from the opinion route', async () => {
    // The two sections have separate URL spaces (ADR-0007). A slug published
    // under one must not resolve under the other.
    const db = testDb();
    await seedPost(db, {
      section: 'analysis',
      localizations: [{ locale: 'es', slug: 'ambiguo', publishedAt: PUBLISHED }],
    });

    expect(
      await getPublishedPost(db, { locale: 'es', section: 'opinion', slug: 'ambiguo' })
    ).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    const db = testDb();

    expect(
      await getPublishedPost(db, { locale: 'es', section: 'analysis', slug: 'no-existe' })
    ).toBeNull();
  });

  it('serves the published revision rather than the newest one', async () => {
    // A newer draft revision must not reach readers. The query resolves through
    // `published_revision_id`, not through the highest version number.
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

    const post = await getPublishedPost(db, {
      locale: 'es',
      section: 'analysis',
      slug: 'revisado',
    });

    expect(post?.title).toBe('Publicada');
  });
});
