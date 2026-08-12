import { and, asc, count, eq, isNotNull } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { resolveLocalizationUrl } from '@/lib/urls';

import type { PostSummary } from '@/db/queries/listings';
import type { Locale } from '@/i18n/locales';

/**
 * Editorial series (ADR-0012, ADR-0010).
 *
 * A collection mirrors a post: `collections` is the locale-neutral aggregate
 * with its own `editorial_state`, and `collection_localizations` carries the
 * per-locale slug, title and lifecycle status.
 *
 * That symmetry is the point. ADR-0010 applies its `404`/`410` rule to **every**
 * publishable localized entity, not only to posts, so a withdrawn series URL
 * behaves exactly like a withdrawn article — and this file reaches for the same
 * `resolveLocalizationUrl` the article routes use rather than restating the
 * rule.
 *
 * **Collection slugs are immutable after publication.** There is no slug history
 * table for them, and ADR-0010 calls a mutable slug with no history "the one
 * combination that silently breaks links". Nothing here can rename one; the
 * admin must not offer it either, until that table exists.
 */

export type PublishedCollection = {
  collectionId: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
};

export type CollectionUrlResolution =
  | { kind: 'render'; collection: PublishedCollection }
  | { kind: 'gone' }
  | { kind: 'not-found' };

/**
 * Resolves a series URL.
 *
 * No `redirect` arm, and that is not an oversight: with no slug history there
 * is nothing a retired collection slug could redirect to. `null` is passed for
 * the retired target so the shared resolver simply never reaches that branch.
 */
export async function resolveCollectionUrl(
  db: Db,
  criteria: { locale: Locale; slug: string }
): Promise<CollectionUrlResolution> {
  const [live] = await db
    .select({
      collectionId: schema.collections.id,
      status: schema.collectionLocalizations.status,
      firstPublishedAt: schema.collectionLocalizations.firstPublishedAt,
      editorialState: schema.collections.editorialState,
      title: schema.collectionLocalizations.title,
      description: schema.collectionLocalizations.description,
    })
    .from(schema.collectionLocalizations)
    .innerJoin(
      schema.collections,
      eq(schema.collections.id, schema.collectionLocalizations.collectionId)
    )
    .where(
      and(
        eq(schema.collectionLocalizations.locale, criteria.locale),
        eq(schema.collectionLocalizations.slug, criteria.slug)
      )
    )
    .limit(1);

  const resolution = resolveLocalizationUrl(
    live
      ? {
          servable: live.status === 'published' && live.editorialState === 'active',
          firstPublishedAt: live.firstPublishedAt,
        }
      : null,
    null
  );

  // Unreachable while collections keep no slug history — `null` is passed for
  // the retired target above — but stated rather than assumed, so adding that
  // table later is a compile-time conversation instead of a silent wrong answer.
  if (resolution.kind === 'redirect') return { kind: 'not-found' };

  if (resolution.kind !== 'render') return resolution;
  if (!live) return { kind: 'not-found' };

  return {
    kind: 'render',
    collection: {
      collectionId: live.collectionId,
      title: live.title,
      description: live.description,
      publishedAt: live.firstPublishedAt,
    },
  };
}

/**
 * The posts in a series, in the order the editor chose.
 *
 * Ordered by `collection_posts.position`, **not** by date: a series has an
 * authored reading order, and sorting it chronologically would silently discard
 * the only thing that makes it a series rather than a tag (ADR-0012).
 *
 * One joined query, like every other listing (ADR-0016).
 */
export async function listCollectionPosts(
  db: Db,
  collectionId: string,
  locale: Locale
): Promise<PostSummary[]> {
  return (
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
      .from(schema.collectionPosts)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.collectionPosts.postId))
      .innerJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
      .innerJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      .leftJoin(schema.authors, eq(schema.authors.id, schema.posts.authorId))
      // Left: a post without a cover still lists.
      .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
      .where(
        and(
          eq(schema.collectionPosts.collectionId, collectionId),
          eq(schema.postLocalizations.locale, locale),
          eq(schema.postLocalizations.status, 'published'),
          isNotNull(schema.postLocalizations.firstPublishedAt),
          eq(schema.posts.editorialState, 'active')
        )
      )
      .orderBy(asc(schema.collectionPosts.position))
  );
}

/** The series a post belongs to, in the locale being read. */
export type PostSeries = {
  slug: string;
  title: string;
  /** 1-based, so it reads as "part 2 of 4" rather than "index 1". */
  position: number;
  total: number;
};

/**
 * Which series a post belongs to, if any.
 *
 * A post can sit in several collections in principle; this returns the first by
 * position, because the indicator on an article has room for one and the
 * alternative — listing them all above the headline — turns a helpful signal
 * into furniture.
 *
 * Only **published** collections in the locale being read. An unpublished
 * series is not something to advertise, and a series published in one language
 * only must not appear over an article in the other.
 *
 * Two queries rather than one: the membership row and the size of the series.
 * `total` cannot come from the same row without a window function, and D1
 * budgets by query count, not by round trip (ADR-0016) — two small ones on a
 * page that already spends several is a fair price for "part 2 of 4", which is
 * the part that makes the indicator worth showing at all.
 */
export async function findPostSeries(
  db: Db,
  postId: string,
  locale: Locale
): Promise<PostSeries | null> {
  const [membership] = await db
    .select({
      collectionId: schema.collectionPosts.collectionId,
      position: schema.collectionPosts.position,
      slug: schema.collectionLocalizations.slug,
      title: schema.collectionLocalizations.title,
    })
    .from(schema.collectionPosts)
    .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionPosts.collectionId))
    .innerJoin(
      schema.collectionLocalizations,
      eq(schema.collectionLocalizations.collectionId, schema.collectionPosts.collectionId)
    )
    .where(
      and(
        eq(schema.collectionPosts.postId, postId),
        eq(schema.collectionLocalizations.locale, locale),
        eq(schema.collectionLocalizations.status, 'published'),
        eq(schema.collections.editorialState, 'active')
      )
    )
    .orderBy(schema.collectionPosts.position)
    .limit(1);

  if (!membership) return null;

  const [size] = await db
    .select({ total: count() })
    .from(schema.collectionPosts)
    .where(eq(schema.collectionPosts.collectionId, membership.collectionId));

  return {
    slug: membership.slug,
    title: membership.title,
    // Stored positions start at zero; readers do not.
    position: membership.position + 1,
    total: size?.total ?? 1,
  };
}
