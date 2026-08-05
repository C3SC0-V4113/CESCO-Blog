import { and, eq } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { parseContentDoc, type ContentDoc } from '@/lib/content/schema';
import { resolveLocalizationUrl } from '@/lib/urls';

import type { Post } from '@/db/schema';
import type { Locale } from '@/i18n/locales';

/** Derived from the column rather than restated, so the two cannot drift. */
export type PostSection = Post['section'];

export type PublishedPost = {
  title: string;
  excerpt: string | null;
  content: ContentDoc;
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
 * One query answers the common case. The slug history is only consulted when no
 * live slug matched, so a served article costs a single query against the 50 a
 * Worker invocation may issue (ADR-0016).
 *
 * The published revision is reached through `published_revision_id`, never
 * through the highest `version`, so a newer draft revision cannot reach readers.
 */
export async function resolveArticleUrl(
  db: Db,
  criteria: UrlCriteria
): Promise<ArticleUrlResolution> {
  const [live] = await db
    .select({
      status: schema.postLocalizations.status,
      firstPublishedAt: schema.postLocalizations.firstPublishedAt,
      editorialState: schema.posts.editorialState,
      title: schema.postRevisions.title,
      excerpt: schema.postRevisions.excerpt,
      contentJson: schema.postRevisions.contentJson,
    })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    // Left, not inner: a withdrawn localization has no published revision, and
    // it still has to answer 410 rather than fall out of the result set.
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(
      and(
        eq(schema.postLocalizations.locale, criteria.locale),
        eq(schema.postLocalizations.slug, criteria.slug),
        eq(schema.posts.section, criteria.section)
      )
    )
    .limit(1);

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
      title: live.title,
      excerpt: live.excerpt,
      // Validated on the way out, not trusted, and only once the response is
      // known to be a render — a malformed revision must not turn a 410 into a
      // crash (ADR-0024).
      content: parseContentDoc(live.contentJson),
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
