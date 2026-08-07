import { beforeEach, describe, expect, it } from 'vitest';

import { listFeedItems, listSitemapEntries } from '@/db/queries/distribution';
import { resolveArticleUrl } from '@/db/queries/posts';

import { at, renameSlug, resetContent, seedPost, testDb, withdraw } from './fixtures';

/**
 * The syndication reads (ADR-0014).
 *
 * These suites read everything rather than one row, so they need a clean table
 * per test — see `resetContent`.
 */

const PUBLISHED = at('2026-05-01T10:00:00Z');

beforeEach(async () => {
  await resetContent(testDb());
});

describe('listFeedItems', () => {
  it('identifies an item by its localization, not by its URL', async () => {
    // The guid must survive a rename. If it were the URL, every subscriber
    // would receive the article again as though it were new (ADR-0014).
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'nombre-viejo', publishedAt: PUBLISHED }],
    });
    const localizationId = seeded.localizations[0]!.id;

    const before = await listFeedItems(db, 'es', 20);
    await renameSlug(db, localizationId, 'es', 'nombre-viejo', 'nombre-nuevo');
    const after = await listFeedItems(db, 'es', 20);

    expect(before[0]?.localizationId).toBe(localizationId);
    expect(after[0]?.localizationId).toBe(localizationId);
    // The address moved; the identity did not.
    expect(after[0]?.slug).toBe('nombre-nuevo');
  });

  it('orders by first publication so republishing does not re-notify', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'vieja', publishedAt: at('2026-01-01T10:00:00Z') }],
    });
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'nueva', publishedAt: at('2026-06-01T10:00:00Z') }],
    });

    expect((await listFeedItems(db, 'es', 20)).map((i) => i.slug)).toEqual(['nueva', 'vieja']);
  });

  it('excludes a withdrawn localization', async () => {
    // Its URL answers 410; advertising it would invite crawlers back to it.
    const db = testDb();
    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'retirada', publishedAt: PUBLISHED }],
    });
    await withdraw(db, seeded.localizations[0]!.id);

    expect(await listFeedItems(db, 'es', 20)).toEqual([]);
  });

  it('keeps each locale to its own feed', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'espanol', publishedAt: PUBLISHED },
        { locale: 'en', slug: 'english', publishedAt: PUBLISHED },
      ],
    });

    expect((await listFeedItems(db, 'es', 20)).map((i) => i.slug)).toEqual(['espanol']);
    expect((await listFeedItems(db, 'en', 20)).map((i) => i.slug)).toEqual(['english']);
  });

  it('caps the item count', async () => {
    const db = testDb();
    for (const day of ['01', '02', '03']) {
      await seedPost(db, {
        localizations: [
          { locale: 'es', slug: `p-${day}`, publishedAt: at(`2026-07-${day}T10:00:00Z`) },
        ],
      });
    }

    expect(await listFeedItems(db, 'es', 2)).toHaveLength(2);
  });
});

describe('listSitemapEntries', () => {
  it('lists every servable localization across locales', async () => {
    const db = testDb();
    await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'espanol', publishedAt: PUBLISHED },
        { locale: 'en', slug: 'english', publishedAt: PUBLISHED },
      ],
    });

    expect((await listSitemapEntries(db)).map((e) => e.locale).sort()).toEqual(['en', 'es']);
  });

  it('excludes drafts and archived posts', async () => {
    const db = testDb();
    await seedPost(db, { localizations: [{ locale: 'es', slug: 'borrador' }] });
    await seedPost(db, {
      editorialState: 'archived',
      localizations: [{ locale: 'es', slug: 'archivado', publishedAt: PUBLISHED }],
    });

    expect(await listSitemapEntries(db)).toEqual([]);
  });

  it('shares its lastmod source with the JSON-LD dateModified', async () => {
    // The test ADR-0014 asks for by name: "one source, two consumers, and a
    // test asserting the two agree". A sitemap that disagrees with the page it
    // describes is a slow, silent trust problem.
    const db = testDb();
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'compartida', publishedAt: PUBLISHED }],
    });

    const [entry] = await listSitemapEntries(db);
    const resolution = await resolveArticleUrl(db, {
      locale: 'es',
      section: 'analysis',
      slug: 'compartida',
    });

    expect(resolution.kind).toBe('render');
    expect(entry?.lastModified).toBe(
      resolution.kind === 'render' ? resolution.post.updatedAt : null
    );
  });
});
