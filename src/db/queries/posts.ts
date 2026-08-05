import { and, eq } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { parseContentDoc, type ContentDoc } from '@/lib/content/schema';

import type { Post } from '@/db/schema';
import type { Locale } from '@/i18n/locales';

/** Derived from the column rather than restated, so the two cannot drift. */
export type PostSection = Post['section'];

export type PublishedPost = {
  title: string;
  excerpt: string | null;
  content: ContentDoc;
};

/**
 * Resolves a public article URL to the revision that should be rendered.
 *
 * **One query.** A Worker invocation may issue at most 50 queries (ADR-0016),
 * and page composition is the thing most likely to spend them carelessly, so
 * the localization, its post, and its published revision are joined rather than
 * fetched in sequence.
 *
 * Three conditions each make a URL non-servable, and all three are enforced
 * here rather than by the caller:
 *
 * - the localization is not `published` — a draft, or one that was withdrawn
 * - the post is `archived` — the aggregate switch of ADR-0009 overrides a
 *   published localization
 * - the join through `published_revision_id` finds nothing, which is what a
 *   withdrawn localization leaves behind
 *
 * Returning `null` says only "nothing to render". Whether that becomes a `404`
 * or a `410` is the URL lifecycle resolver's decision (ADR-0010), because the
 * answer depends on `first_published_at` rather than on the current state.
 *
 * The revision is reached through `published_revision_id`, never through the
 * highest `version`: a newer draft revision must not reach readers.
 */
export async function getPublishedPost(
  db: Db,
  criteria: { locale: Locale; section: PostSection; slug: string }
): Promise<PublishedPost | null> {
  const rows = await db
    .select({
      title: schema.postRevisions.title,
      excerpt: schema.postRevisions.excerpt,
      contentJson: schema.postRevisions.contentJson,
    })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .innerJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(
      and(
        eq(schema.postLocalizations.locale, criteria.locale),
        eq(schema.postLocalizations.slug, criteria.slug),
        eq(schema.postLocalizations.status, 'published'),
        eq(schema.posts.section, criteria.section),
        eq(schema.posts.editorialState, 'active')
      )
    )
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  return {
    title: row.title,
    excerpt: row.excerpt,
    // Validated on the way out, not trusted. A malformed revision raises here
    // instead of reaching the renderer and producing a silently broken article
    // (ADR-0024). Everything that writes `content_json` validates on the way in,
    // so this firing means the two contracts have diverged.
    content: parseContentDoc(row.contentJson),
  };
}
