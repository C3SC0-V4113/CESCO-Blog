import { beforeEach, describe, expect, it } from 'vitest';

import { listPublishedPosts } from '@/db/queries/listings';

import { at, resetContent, seedPost, testDb, withdraw } from './fixtures';

/**
 * The listing read path (ADR-0014, ADR-0016).
 *
 * Ordering is the part worth testing hardest. It runs off
 * `first_published_at DESC` on a TEXT column, so it depends on the stored
 * format sorting lexicographically the same way it sorts chronologically
 * (ADR-0029) — and on the timestamp being the immutable one, so republishing
 * cannot bump a post back to the top.
 */

const PAGE = { limit: 10, offset: 0 };

beforeEach(async () => {
  await resetContent(testDb());
});

describe('listPublishedPosts', () => {
  it('orders by first publication, newest first', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'vieja', title: 'Vieja', publishedAt: at('2026-01-01T10:00:00Z') },
      ],
    });
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'nueva', title: 'Nueva', publishedAt: at('2026-06-01T10:00:00Z') },
      ],
    });

    const { posts } = await listPublishedPosts(db, { locale: 'es', ...PAGE });

    expect(posts.map((p) => p.slug)).toEqual(['nueva', 'vieja']);
  });

  it('sorts correctly among posts published on the same day', async () => {
    // The case ADR-0029 exists for: within one day the comparison reaches the
    // separator, and a format mismatch there reverses the order silently.
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'manana', publishedAt: at('2026-03-01T08:00:00Z') }],
    });
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'noche', publishedAt: at('2026-03-01T23:00:00Z') }],
    });

    const { posts } = await listPublishedPosts(db, { locale: 'es', ...PAGE });

    expect(posts.map((p) => p.slug)).toEqual(['noche', 'manana']);
  });

  it('excludes drafts, withdrawals and archived posts', async () => {
    const db = testDb();
    await seedPost(db, { localizations: [{ locale: 'es', slug: 'borrador' }] });

    const withdrawn = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'retirado', publishedAt: at('2026-02-01T10:00:00Z') }],
    });
    await withdraw(db, withdrawn.localizations[0]!.id);

    await seedPost(db, {
      editorialState: 'archived',
      localizations: [{ locale: 'es', slug: 'archivado', publishedAt: at('2026-02-02T10:00:00Z') }],
    });

    const { posts, total } = await listPublishedPosts(db, { locale: 'es', ...PAGE });

    expect(posts).toEqual([]);
    expect(total).toBe(0);
  });

  it('keeps each locale to its own posts', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'espanol', publishedAt: at('2026-04-01T10:00:00Z') },
        { locale: 'en', slug: 'english', publishedAt: at('2026-04-01T10:00:00Z') },
      ],
    });

    const spanish = await listPublishedPosts(db, { locale: 'es', ...PAGE });
    const english = await listPublishedPosts(db, { locale: 'en', ...PAGE });

    expect(spanish.posts.map((p) => p.slug)).toEqual(['espanol']);
    expect(english.posts.map((p) => p.slug)).toEqual(['english']);
  });

  it('filters by section when asked', async () => {
    const db = testDb();
    await seedPost(db, {
      section: 'analysis',
      localizations: [
        { locale: 'es', slug: 'un-analisis', publishedAt: at('2026-05-01T10:00:00Z') },
      ],
    });
    await seedPost(db, {
      section: 'opinion',
      localizations: [
        { locale: 'es', slug: 'una-opinion', publishedAt: at('2026-05-02T10:00:00Z') },
      ],
    });

    const analysis = await listPublishedPosts(db, { locale: 'es', section: 'analysis', ...PAGE });
    const everything = await listPublishedPosts(db, { locale: 'es', ...PAGE });

    expect(analysis.posts.map((p) => p.slug)).toEqual(['un-analisis']);
    expect(everything.posts).toHaveLength(2);
  });

  it('paginates without losing the total', async () => {
    const db = testDb();
    for (const day of ['01', '02', '03']) {
      await seedPost(db, {
        localizations: [
          { locale: 'es', slug: `post-${day}`, publishedAt: at(`2026-07-${day}T10:00:00Z`) },
        ],
      });
    }

    const first = await listPublishedPosts(db, { locale: 'es', limit: 2, offset: 0 });
    const second = await listPublishedPosts(db, { locale: 'es', limit: 2, offset: 2 });

    expect(first.posts.map((p) => p.slug)).toEqual(['post-03', 'post-02']);
    expect(second.posts.map((p) => p.slug)).toEqual(['post-01']);
    // The count is the whole set, not the page — pagination cannot derive it
    // from a limited result.
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
  });

  it('carries what a card needs without a query per card', async () => {
    const db = testDb();
    await seedPost(db, {
      withAuthor: true,
      localizations: [
        {
          locale: 'es',
          slug: 'con-todo',
          title: 'Con todo',
          publishedAt: at('2026-08-01T10:00:00Z'),
        },
      ],
    });

    const [post] = (await listPublishedPosts(db, { locale: 'es', ...PAGE })).posts;

    expect(post?.title).toBe('Con todo');
    expect(post?.authorName).toBe('Cesco Valle');
    expect(post?.readingTimeMinutes).toBe(5);
    expect(post?.section).toBe('analysis');
  });
});
