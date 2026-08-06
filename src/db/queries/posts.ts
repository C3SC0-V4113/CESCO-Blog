import { and, eq, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { schema, type Db } from '@/db/client';
import { parseContentDoc, parseToc, type ContentDoc, type TocEntry } from '@/lib/content/schema';
import { resolveLocalizationUrl } from '@/lib/urls';

import type { Post, PostAnalysisMetadata } from '@/db/schema';
import type { Locale } from '@/i18n/locales';

/** Derived from the column rather than restated, so the two cannot drift. */
export type PostSection = Post['section'];

/** Same reasoning: the enum lives on the column, not in a second list here. */
export type CompletionState = NonNullable<PostAnalysisMetadata['completionState']>;

export type AnalysisMetadata = {
  playedPlatform: string | null;
  playtimeHours: number | null;
  completionState: CompletionState | null;
  receivedReviewCopy: boolean;
  reviewCopyProvider: string | null;
};

/**
 * The game a post is about.
 *
 * Deliberately **not** folded into `AnalysisMetadata`: `game_id` lives on
 * `posts`, so an opinion piece can name one exactly as an analysis can. Putting
 * it on the metadata row would model a relationship the schema does not have,
 * and would strand the game the day an opinion piece wants to show it.
 */
export type PostGame = {
  slug: string;
  title: string;
};

export type PublishedPost = {
  /** Locale-neutral aggregate id, used to tag both localizations alike (ADR-0011). */
  postId: string;
  title: string;
  excerpt: string | null;
  content: ContentDoc;
  readingTimeMinutes: number | null;
  toc: TocEntry[];
  /**
   * First publication, never the most recent one. ADR-0010 keeps
   * `first_published_at` immutable so `datePublished` survives an unpublish and
   * republish cycle, and the byline shows the same date it always showed.
   */
  publishedAt: string | null;
  /**
   * `created_at` of the published revision, and the only value that changes
   * when — and only when — the published content changes. ADR-0013 forbids
   * taking `dateModified` from `post_localizations.updated_at`, which moves for
   * bookkeeping the reader never sees. The sitemap's `lastmod` reads the same
   * field, so the two cannot disagree.
   */
  updatedAt: string | null;
  section: PostSection;
  authorName: string | null;
  /**
   * Published counterparts, this locale included. Drives `hreflang`, the Open
   * Graph locale pair and the locale switch — all of which must offer only
   * localizations that can actually be served (ADR-0013).
   */
  alternates: { locale: Locale; slug: string }[];
  /** Present only for analysis posts that have a metadata row (ADR-0012). */
  analysis: AnalysisMetadata | null;
  /** The game the piece covers, when it names one. */
  game: PostGame | null;
};

export type ArticleUrlResolution =
  | { kind: 'render'; post: PublishedPost }
  | { kind: 'redirect'; slug: string }
  | { kind: 'gone' }
  | { kind: 'not-found' };

type UrlCriteria = { locale: Locale; section: PostSection; slug: string };

/**
 * Resolves a public article URL to the response it should receive (ADR-0010).
 *
 * The live localization is fetched **without** filtering on status or editorial
 * state. That is deliberate: filtering them out in SQL would make a withdrawn
 * post indistinguishable from one that never existed, which is exactly the
 * distinction this ADR exists to preserve. The row comes back whatever its
 * state, and the policy decides.
 *
 * **Two queries, issued together.** The article read spans six tables in one
 * statement; the alternate set is a self-join that cannot collapse into the same
 * row, so it runs beside it rather than after it. A Worker invocation may issue
 * at most 50 (ADR-0016), and neither query needs the other.
 *
 * The article read stays one statement because the page needs the author, the
 * derived fields and the analysis metadata together, and fetching them
 * separately would spend four queries where one does. The slug history is only
 * consulted when no live slug matched.
 *
 * The published revision is reached through `published_revision_id`, never
 * through the highest `version`, so a newer draft cannot reach readers.
 */
export async function resolveArticleUrl(
  db: Db,
  criteria: UrlCriteria
): Promise<ArticleUrlResolution> {
  const [[live], alternates] = await Promise.all([
    db
      .select({
        postId: schema.posts.id,
        status: schema.postLocalizations.status,
        firstPublishedAt: schema.postLocalizations.firstPublishedAt,
        editorialState: schema.posts.editorialState,
        section: schema.posts.section,
        title: schema.postRevisions.title,
        excerpt: schema.postRevisions.excerpt,
        contentJson: schema.postRevisions.contentJson,
        readingTimeMinutes: schema.postRevisions.readingTimeMinutes,
        tocJson: schema.postRevisions.tocJson,
        updatedAt: schema.postRevisions.createdAt,
        authorName: schema.authors.name,
        playedPlatform: schema.platforms.name,
        playtimeHours: schema.postAnalysisMetadata.playtimeHours,
        completionState: schema.postAnalysisMetadata.completionState,
        receivedReviewCopy: schema.postAnalysisMetadata.receivedReviewCopy,
        reviewCopyProvider: schema.postAnalysisMetadata.reviewCopyProvider,
        gameSlug: schema.games.slug,
        gameTitle: schema.games.title,
      })
      .from(schema.postLocalizations)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
      // Left, not inner: a withdrawn localization has no published revision, and
      // it still has to answer 410 rather than fall out of the result set.
      .leftJoin(
        schema.postRevisions,
        eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
      )
      // Every remaining join is optional by nature. A post may have no author, an
      // opinion piece has no analysis metadata, and an analysis need not name the
      // platform it was played on — none of which makes the URL unservable.
      .leftJoin(schema.authors, eq(schema.authors.id, schema.posts.authorId))
      .leftJoin(
        schema.postAnalysisMetadata,
        eq(schema.postAnalysisMetadata.postId, schema.posts.id)
      )
      .leftJoin(
        schema.platforms,
        eq(schema.platforms.id, schema.postAnalysisMetadata.playedPlatformId)
      )
      // Joined from `posts` rather than from the analysis row, because that is
      // where `game_id` lives — an opinion piece can name a game too. Still one
      // query: a seventh join costs nothing against the 50 a Worker invocation
      // is allowed, while a second round trip would (ADR-0016).
      .leftJoin(schema.games, eq(schema.games.id, schema.posts.gameId))
      .where(
        and(
          eq(schema.postLocalizations.locale, criteria.locale),
          eq(schema.postLocalizations.slug, criteria.slug),
          eq(schema.posts.section, criteria.section)
        )
      )
      .limit(1),

    findPublishedAlternates(db, criteria),
  ]);

  const retiredSlugTarget = live ? null : await findCurrentSlugFor(db, criteria);

  const resolution = resolveLocalizationUrl(
    live
      ? {
          servable:
            live.status === 'published' && live.editorialState === 'active' && live.title !== null,
          firstPublishedAt: live.firstPublishedAt,
        }
      : null,
    retiredSlugTarget
  );

  if (resolution.kind !== 'render') return resolution;

  // Unreachable: `servable` already required a joined revision. Written as a
  // narrowing guard rather than an assertion so the compiler proves it.
  if (!live || live.title === null) return { kind: 'not-found' };

  return {
    kind: 'render',
    post: {
      postId: live.postId,
      title: live.title,
      excerpt: live.excerpt,
      // Validated on the way out, not trusted, and only once the response is
      // known to be a render — a malformed revision must not turn a 410 into a
      // crash (ADR-0024).
      content: parseContentDoc(live.contentJson),
      readingTimeMinutes: live.readingTimeMinutes,
      toc: parseToc(live.tocJson),
      publishedAt: live.firstPublishedAt,
      updatedAt: live.updatedAt,
      section: live.section,
      alternates,
      authorName: live.authorName,
      // `receivedReviewCopy` is the presence signal: it is `NOT NULL` on the
      // table, so a null here means the left join found no row at all rather
      // than a row saying "no review copy".
      analysis:
        live.receivedReviewCopy === null
          ? null
          : {
              playedPlatform: live.playedPlatform,
              playtimeHours: live.playtimeHours,
              completionState: live.completionState,
              receivedReviewCopy: live.receivedReviewCopy,
              reviewCopyProvider: live.reviewCopyProvider,
            },
      // Both columns are `NOT NULL` on `games`, so either the join found a row
      // and they are both present, or the post names no game at all. Checking
      // one of them would leave the other's type merely asserted.
      game:
        live.gameSlug !== null && live.gameTitle !== null
          ? { slug: live.gameSlug, title: live.gameTitle }
          : null,
    },
  };
}

/**
 * Current slug of the localization a retired slug used to name.
 *
 * Returns the destination directly rather than the previous name, so a slug
 * renamed A→B→C sends A straight to C. ADR-0010 forbids redirect chains, and
 * the rename path keeps that true by rewriting history rows instead of
 * appending to them.
 *
 * Filtered by section: a slug retired under `analysis` must not redirect from
 * an `opinion` URL that never carried it.
 */
async function findCurrentSlugFor(db: Db, criteria: UrlCriteria): Promise<string | null> {
  const [retired] = await db
    .select({ slug: schema.postLocalizations.slug })
    .from(schema.postLocalizationSlugHistory)
    .innerJoin(
      schema.postLocalizations,
      eq(schema.postLocalizations.id, schema.postLocalizationSlugHistory.postLocalizationId)
    )
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .where(
      and(
        eq(schema.postLocalizationSlugHistory.locale, criteria.locale),
        eq(schema.postLocalizationSlugHistory.oldSlug, criteria.slug),
        eq(schema.posts.section, criteria.section)
      )
    )
    .limit(1);

  return retired?.slug ?? null;
}

/**
 * Published counterparts of this article, the current locale included.
 *
 * A self-join: the same post reached twice, once by the URL and once for every
 * localization hanging off it. Only servable ones are returned, because
 * ADR-0013 forbids declaring an alternate that cannot be served — an `hreflang`
 * pointing at a 404 is worse than a missing one.
 */
async function findPublishedAlternates(
  db: Db,
  criteria: UrlCriteria
): Promise<{ locale: Locale; slug: string }[]> {
  const sibling = alias(schema.postLocalizations, 'sibling');

  return db
    .select({ locale: sibling.locale, slug: sibling.slug })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .innerJoin(sibling, eq(sibling.postId, schema.posts.id))
    .where(
      and(
        eq(schema.postLocalizations.locale, criteria.locale),
        eq(schema.postLocalizations.slug, criteria.slug),
        eq(schema.posts.section, criteria.section),
        eq(schema.posts.editorialState, 'active'),
        eq(sibling.status, 'published'),
        isNotNull(sibling.firstPublishedAt)
      )
    );
}
