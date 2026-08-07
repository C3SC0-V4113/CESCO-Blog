import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';

import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

/**
 * Reads for the syndication endpoints (ADR-0014).
 *
 * Both assemble their rows in a **single joined query**. D1 permits 50 queries
 * per Worker invocation (ADR-0016), so a per-post read would not merely be slow
 * — it would start failing once a feed or sitemap passed fifty entries. The
 * platform rules out N+1 here rather than penalising it.
 *
 * Both include only publicly servable localizations: the post active, the
 * localization published. A withdrawn URL answers `410`, and advertising it in
 * a feed would invite crawlers back to it.
 */

export type FeedItem = {
  /**
   * The localization id, which becomes the RSS `guid`.
   *
   * Deliberately not the URL. Slugs are mutable (ADR-0010), so a URL-based
   * `guid` changes on a rename and every subscriber receives the article again
   * as if it were new. The link carries the address; the `guid` carries
   * identity, and identity does not move.
   */
  localizationId: string;
  slug: string;
  section: PostSection;
  title: string;
  excerpt: string | null;
  publishedAt: string;
};

export type SitemapEntry = {
  locale: Locale;
  slug: string;
  section: PostSection;
  /**
   * `lastmod`, taken from the published revision's `created_at` — the **same
   * source** ADR-0013 requires for JSON-LD `dateModified`. One source, two
   * consumers; an integration test asserts the two agree, because the failure
   * would otherwise be a sitemap quietly disagreeing with the page it describes.
   */
  lastModified: string | null;
};

/** Servable rows only: the filter both endpoints share. */
const servable = (locale?: Locale) =>
  and(
    eq(schema.postLocalizations.status, 'published'),
    isNotNull(schema.postLocalizations.firstPublishedAt),
    eq(schema.posts.editorialState, 'active'),
    locale ? eq(schema.postLocalizations.locale, locale) : undefined
  );

/**
 * The most recent items for one locale's feed.
 *
 * Ordered by `first_published_at`, not `current_published_at`: republishing a
 * post must not push it back to the top of the feed and re-notify everyone.
 */
export async function listFeedItems(db: Db, locale: Locale, limit: number): Promise<FeedItem[]> {
  const rows = await db
    .select({
      localizationId: schema.postLocalizations.id,
      slug: schema.postLocalizations.slug,
      section: schema.posts.section,
      title: schema.postRevisions.title,
      excerpt: schema.postRevisions.excerpt,
      publishedAt: schema.postLocalizations.firstPublishedAt,
    })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .innerJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(servable(locale))
    .orderBy(desc(schema.postLocalizations.firstPublishedAt))
    .limit(limit);

  // `firstPublishedAt` is filtered non-null above; this narrows the type without
  // a cast so the feed's required `pubDate` cannot be undefined.
  return rows.flatMap((row) =>
    row.publishedAt === null ? [] : [{ ...row, publishedAt: row.publishedAt }]
  );
}

/** Every servable localization, both languages, for the sitemap. */
export async function listSitemapEntries(db: Db): Promise<SitemapEntry[]> {
  return db
    .select({
      locale: schema.postLocalizations.locale,
      slug: schema.postLocalizations.slug,
      section: schema.posts.section,
      lastModified: schema.postRevisions.createdAt,
    })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .innerJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(servable())
    .orderBy(desc(schema.postLocalizations.firstPublishedAt));
}
