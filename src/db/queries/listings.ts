import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';

import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

/**
 * Listing reads (ADR-0014, ADR-0016).
 *
 * Ordered by `first_published_at DESC` — the immutable timestamp, so
 * republishing a post does not push it back to the top of the list. That
 * ordering is also why the column is TEXT in SQLite's `CURRENT_TIMESTAMP`
 * format rather than ISO: the sort is lexicographic, and mixing formats
 * corrupts it within a single day (ADR-0029).
 */

export type PostSummary = {
  slug: string;
  section: PostSection;
  title: string;
  excerpt: string | null;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  authorName: string | null;
  /**
   * The editorial cover's R2 key, or `null` for a post without one.
   *
   * The key rather than the media id, because the delivery route is addressed
   * by key (ADR-0033) — carrying the id would mean a second lookup per card to
   * turn it back into an address, which is exactly the per-row query the
   * listing is built to avoid.
   */
  coverKey: string | null;
};

export type ListingPage = {
  posts: PostSummary[];
  total: number;
};

type ListingCriteria = {
  locale: Locale;
  /** Omit for every section. */
  section?: PostSection;
  limit: number;
  offset: number;
};

/**
 * A page of published posts.
 *
 * **Two queries, never one per card.** D1 allows 50 per Worker invocation and a
 * listing is the easiest place to spend them badly: fetching each card's author
 * separately would turn a twenty-post page into twenty-one queries and scale
 * with the page size. Everything a card needs is joined, and the second query
 * is the total, which pagination cannot compute from a limited result set.
 *
 * `isNotNull(firstPublishedAt)` is belt and braces beside the `published`
 * status: ordering by a column that could be null would put those rows in an
 * arbitrary position rather than excluding them.
 */
export async function listPublishedPosts(db: Db, criteria: ListingCriteria): Promise<ListingPage> {
  const where = and(
    eq(schema.postLocalizations.locale, criteria.locale),
    eq(schema.postLocalizations.status, 'published'),
    isNotNull(schema.postLocalizations.firstPublishedAt),
    eq(schema.posts.editorialState, 'active'),
    criteria.section ? eq(schema.posts.section, criteria.section) : undefined
  );

  // Issued together, not one after the other: they share a filter but neither
  // needs the other's result, and awaiting them in sequence pays two round
  // trips to D1 where one wall-clock wait would do.
  const [posts, [counted]] = await Promise.all([
    db
      .select({
        slug: schema.postLocalizations.slug,
        section: schema.posts.section,
        title: schema.postRevisions.title,
        excerpt: schema.postRevisions.excerpt,
        readingTimeMinutes: schema.postRevisions.readingTimeMinutes,
        publishedAt: schema.postLocalizations.firstPublishedAt,
        authorName: schema.authors.name,
        coverKey: schema.mediaAssets.r2Key,
      })
      .from(schema.postLocalizations)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
      // Inner here, unlike the detail read: a listing only shows servable posts,
      // so a localization without a published revision has nothing to render.
      .innerJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      .leftJoin(schema.authors, eq(schema.authors.id, schema.posts.authorId))
      // Left: a post without a cover still lists.
      .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
      .where(where)
      .orderBy(desc(schema.postLocalizations.firstPublishedAt))
      .limit(criteria.limit)
      .offset(criteria.offset),

    db
      .select({ total: sql<number>`count(*)` })
      .from(schema.postLocalizations)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
      .innerJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      .where(where),
  ]);

  return { posts, total: counted?.total ?? 0 };
}
