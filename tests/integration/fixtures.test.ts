import { asc, desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { schema } from '@/db/client';

import { at, renameSlug, seedPost, testDb, withdraw } from './fixtures';

/**
 * Smoke tests for the harness itself, not for product behaviour.
 *
 * If a feature test fails later, these say whether the scaffolding is sound.
 */
describe('fixture builders', () => {
  it('seeds a post published in Spanish and never published in English', async () => {
    const db = testDb();

    const seeded = await seedPost(db, {
      localizations: [
        { locale: 'es', slug: 'analisis-es', publishedAt: at('2026-01-15T10:00:00Z') },
        { locale: 'en', slug: 'analysis-en' },
      ],
      withAuthor: true,
    });

    const rows = await db
      .select()
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.postId, seeded.postId))
      .orderBy(asc(schema.postLocalizations.locale));

    const [en, es] = rows;

    expect(es.status).toBe('published');
    expect(es.firstPublishedAt).toBe('2026-01-15 10:00:00');

    // Never published: this is what makes its URL a 404 rather than a 410.
    expect(en.status).toBe('draft');
    expect(en.firstPublishedAt).toBeNull();
  });

  it('preserves first_published_at when a localization is withdrawn', async () => {
    const db = testDb();

    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'retirado', publishedAt: at('2026-02-01T09:00:00Z') }],
    });

    const localizationId = seeded.localizations[0].id;
    await withdraw(db, localizationId);

    const [row] = await db
      .select()
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.id, localizationId));

    expect(row.status).toBe('draft');
    // The whole 410 rule rests on this surviving (ADR-0010).
    expect(row.firstPublishedAt).toBe('2026-02-01 09:00:00');
  });

  it('resolves a twice-renamed slug in a single hop', async () => {
    const db = testDb();

    const seeded = await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'slug-a', publishedAt: at('2026-03-01T12:00:00Z') }],
    });

    const localizationId = seeded.localizations[0].id;
    await renameSlug(db, localizationId, 'es', 'slug-a', 'slug-b');
    await renameSlug(db, localizationId, 'es', 'slug-b', 'slug-c');

    const history = await db
      .select()
      .from(schema.postLocalizationSlugHistory)
      .where(eq(schema.postLocalizationSlugHistory.postLocalizationId, localizationId));

    const [current] = await db
      .select()
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.id, localizationId));

    expect(current.slug).toBe('slug-c');
    expect(history.map((row) => row.oldSlug).sort()).toEqual(['slug-a', 'slug-b']);
    // Both retired slugs point at the same localization: no chains.
    expect(new Set(history.map((row) => row.postLocalizationId)).size).toBe(1);
  });

  it('orders by first_published_at as text without format drift', async () => {
    const db = testDb();

    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'viejo', publishedAt: at('2025-06-01T08:00:00Z') }],
    });
    await seedPost(db, {
      localizations: [{ locale: 'es', slug: 'nuevo', publishedAt: at('2026-07-01T08:00:00Z') }],
    });

    const rows = await db
      .select({ slug: schema.postLocalizations.slug })
      .from(schema.postLocalizations)
      .where(eq(schema.postLocalizations.status, 'published'))
      .orderBy(desc(schema.postLocalizations.firstPublishedAt));

    // Lexicographic ordering of the canonical timestamp format is chronological.
    // Writing ISO into the same column would silently break this (ADR-0014).
    expect(rows[0].slug).toBe('nuevo');
  });

  it('records a review copy so the disclosure can be rendered', async () => {
    const db = testDb();

    const seeded = await seedPost(db, {
      section: 'analysis',
      reviewCopyFrom: 'Capcom',
      localizations: [{ locale: 'es', slug: 'con-copia', publishedAt: at('2026-04-01T00:00:00Z') }],
    });

    const [meta] = await db
      .select()
      .from(schema.postAnalysisMetadata)
      .where(eq(schema.postAnalysisMetadata.postId, seeded.postId));

    expect(meta.receivedReviewCopy).toBe(true);
    expect(meta.reviewCopyProvider).toBe('Capcom');
  });
});
