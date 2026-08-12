import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';

import type { PostSummary } from '@/db/queries/listings';
import type { Locale } from '@/i18n/locales';

/**
 * Tags and games (ADR-0012).
 *
 * Neither entity is localized and neither is publishable: a tag is a label and
 * a game is a fact about the world, so they have no `status`, no
 * `first_published_at`, and therefore **no `410`**. A URL that names no tag
 * simply never existed, which is the one case ADR-0010 answers with `404`.
 *
 * The posts they list still obey the full rule — only servable localizations
 * appear — so a tag page never becomes a back door to a withdrawn article.
 */

export type TaxonomySubject = { name: string; slug: string };

export type GameFacts = TaxonomySubject & {
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
};

/** Shared by both surfaces: servable localizations, newest first. */
const servablePosts = (locale: Locale) =>
  and(
    eq(schema.postLocalizations.locale, locale),
    eq(schema.postLocalizations.status, 'published'),
    isNotNull(schema.postLocalizations.firstPublishedAt),
    eq(schema.posts.editorialState, 'active')
  );

const postColumns = {
  slug: schema.postLocalizations.slug,
  section: schema.posts.section,
  title: schema.postRevisions.title,
  excerpt: schema.postRevisions.excerpt,
  readingTimeMinutes: schema.postRevisions.readingTimeMinutes,
  publishedAt: schema.postLocalizations.firstPublishedAt,
  authorName: schema.authors.name,
  coverKey: schema.mediaAssets.r2Key,
};

export async function findTag(db: Db, slug: string): Promise<TaxonomySubject | null> {
  const [tag] = await db
    .select({ name: schema.tags.name, slug: schema.tags.slug })
    .from(schema.tags)
    .where(eq(schema.tags.slug, slug))
    .limit(1);

  return tag ?? null;
}

/** One joined query, like every listing (ADR-0016). */
export async function listPostsByTag(
  db: Db,
  tagSlug: string,
  locale: Locale
): Promise<PostSummary[]> {
  return (
    db
      .select(postColumns)
      .from(schema.postTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.postTags.tagId))
      .innerJoin(schema.posts, eq(schema.posts.id, schema.postTags.postId))
      .innerJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
      .innerJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      .leftJoin(schema.authors, eq(schema.authors.id, schema.posts.authorId))
      // Left: a post without a cover still lists.
      .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
      .where(and(eq(schema.tags.slug, tagSlug), servablePosts(locale)))
      .orderBy(desc(schema.postLocalizations.firstPublishedAt))
  );
}

export async function findGame(db: Db, slug: string): Promise<GameFacts | null> {
  const [game] = await db
    .select({
      name: schema.games.title,
      slug: schema.games.slug,
      developer: schema.games.developer,
      publisher: schema.games.publisher,
      releaseDate: schema.games.releaseDate,
    })
    .from(schema.games)
    .where(eq(schema.games.slug, slug))
    .limit(1);

  return game ?? null;
}

export async function listPostsByGame(
  db: Db,
  gameSlug: string,
  locale: Locale
): Promise<PostSummary[]> {
  return (
    db
      .select(postColumns)
      .from(schema.posts)
      .innerJoin(schema.games, eq(schema.games.id, schema.posts.gameId))
      .innerJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
      .innerJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      .leftJoin(schema.authors, eq(schema.authors.id, schema.posts.authorId))
      // Left: a post without a cover still lists.
      .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
      .where(and(eq(schema.games.slug, gameSlug), servablePosts(locale)))
      .orderBy(desc(schema.postLocalizations.firstPublishedAt))
  );
}
