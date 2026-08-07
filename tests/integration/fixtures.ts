import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';

import { createDb, schema, type Db } from '@/db/client';
import {
  newAuthorId,
  newPostId,
  newPostLocalizationId,
  newPostRevisionId,
  newSlugHistoryId,
} from '@/lib/ids';
import { toDbTimestamp } from '@/lib/timestamps';

/**
 * Fixture builders for the scenarios the ADR test plans require.
 *
 * These exist so lifecycle scenarios read as intent rather than as twenty
 * inserts. The scenarios that matter are the transitions, not the states:
 * published then withdrawn, renamed twice, one locale published before the
 * other.
 */

export type Locale = 'es' | 'en';

export function testDb(): Db {
  return createDb(env.DB);
}

export function at(iso: string): string {
  return toDbTimestamp(new Date(iso));
}

type LocalizationSpec = {
  locale: Locale;
  slug: string;
  /** Omit to leave the localization as a never-published draft. */
  publishedAt?: string;
  /** Published once and then withdrawn: keeps `firstPublishedAt`, drops status. */
  withdrawn?: boolean;
  title?: string;
  featuredAt?: string;
};

type PostSpec = {
  section?: 'analysis' | 'opinion';
  editorialState?: 'active' | 'archived';
  localizations: LocalizationSpec[];
  withAuthor?: boolean;
  reviewCopyFrom?: string;
};

export type SeededPost = {
  postId: string;
  authorId?: string;
  localizations: { locale: Locale; id: string; slug: string; revisionId: string }[];
};

export async function seedPost(db: Db, spec: PostSpec): Promise<SeededPost> {
  const postId = newPostId();
  let authorId: string | undefined;

  if (spec.withAuthor) {
    authorId = newAuthorId();
    await db.insert(schema.authors).values({
      id: authorId,
      slug: `author-${authorId.slice(0, 8)}`,
      name: 'Cesco Valle',
    });
  }

  await db.insert(schema.posts).values({
    id: postId,
    section: spec.section ?? 'analysis',
    editorialState: spec.editorialState ?? 'active',
    authorId,
  });

  if (spec.reviewCopyFrom) {
    await db.insert(schema.postAnalysisMetadata).values({
      postId,
      receivedReviewCopy: true,
      reviewCopyProvider: spec.reviewCopyFrom,
    });
  }

  const localizations: SeededPost['localizations'] = [];

  for (const loc of spec.localizations) {
    const localizationId = newPostLocalizationId();
    const revisionId = newPostRevisionId();
    const published = loc.publishedAt !== undefined;

    await db.insert(schema.postLocalizations).values({
      id: localizationId,
      postId,
      locale: loc.locale,
      slug: loc.slug,
      // A withdrawn localization returns to `draft` but keeps its history.
      status: published && !loc.withdrawn ? 'published' : 'draft',
      publishedRevisionId: published ? revisionId : null,
      // Set once on first publication and never cleared — this is what makes a
      // withdrawn URL answer 410 instead of 404 (ADR-0010).
      firstPublishedAt: published ? loc.publishedAt : null,
      currentPublishedAt: published ? loc.publishedAt : null,
      featuredAt: loc.featuredAt ?? null,
    });

    await db.insert(schema.postRevisions).values({
      id: revisionId,
      postLocalizationId: localizationId,
      version: 1,
      title: loc.title ?? `Post ${loc.slug}`,
      contentJson: { type: 'doc', content: [] },
      readingTimeMinutes: 5,
    });

    localizations.push({ locale: loc.locale, id: localizationId, slug: loc.slug, revisionId });
  }

  return { postId, authorId, localizations };
}

/**
 * Renames a published slug the way the admin must: record the old slug, then
 * rewrite every history row that pointed at it so retired slugs always resolve
 * in a single hop (ADR-0010).
 */
export async function renameSlug(
  db: Db,
  localizationId: string,
  locale: Locale,
  fromSlug: string,
  toSlug: string
): Promise<void> {
  await db
    .update(schema.postLocalizations)
    .set({ slug: toSlug })
    .where(eq(schema.postLocalizations.id, localizationId));

  await db.insert(schema.postLocalizationSlugHistory).values({
    id: newSlugHistoryId(),
    postLocalizationId: localizationId,
    locale,
    oldSlug: fromSlug,
  });

  // No chains: every retired slug for this localization points at the current
  // one, so A -> B -> C resolves A -> C directly.
  await db
    .update(schema.postLocalizationSlugHistory)
    .set({ postLocalizationId: localizationId })
    .where(
      and(
        eq(schema.postLocalizationSlugHistory.postLocalizationId, localizationId),
        eq(schema.postLocalizationSlugHistory.locale, locale)
      )
    );
}

/** Withdraws a published localization: status drops, history is preserved. */
export async function withdraw(db: Db, localizationId: string): Promise<void> {
  await db
    .update(schema.postLocalizations)
    .set({ status: 'draft', publishedRevisionId: null })
    .where(eq(schema.postLocalizations.id, localizationId));
}

/**
 * Empties the editorial tables.
 *
 * Needed by suites that read *everything* rather than one row by slug. A
 * listing sees whatever earlier tests left behind, so without this its
 * assertions depend on which tests ran before it — the kind of failure that
 * appears only when a file is run in a different order.
 *
 * Deleting posts and collections cascades to their localizations, revisions and
 * membership rows; authors have no parent, so they go separately.
 */
export async function resetContent(db: Db): Promise<void> {
  await db.delete(schema.posts);
  await db.delete(schema.collections);
  await db.delete(schema.authors);
}

type CollectionSpec = {
  locale: Locale;
  slug: string;
  title?: string;
  /** Omit to leave it a never-published draft. */
  publishedAt?: string;
  /** Published once and then withdrawn: keeps `firstPublishedAt`, drops status. */
  withdrawn?: boolean;
  editorialState?: 'active' | 'archived';
  /** Post ids in the order the series should read. */
  postIds?: string[];
};

/**
 * Seeds a series and its ordered membership.
 *
 * Mirrors `seedPost` because the schema does: a collection is the same
 * aggregate-plus-localizations shape, which is exactly what lets the URL
 * lifecycle apply to both (ADR-0010, ADR-0012).
 */
export async function seedCollection(db: Db, spec: CollectionSpec): Promise<string> {
  const collectionId = crypto.randomUUID();
  const published = spec.publishedAt !== undefined;

  await db.insert(schema.collections).values({
    id: collectionId,
    editorialState: spec.editorialState ?? 'active',
  });

  await db.insert(schema.collectionLocalizations).values({
    id: crypto.randomUUID(),
    collectionId,
    locale: spec.locale,
    slug: spec.slug,
    title: spec.title ?? `Serie ${spec.slug}`,
    status: published && !spec.withdrawn ? 'published' : 'draft',
    firstPublishedAt: published ? spec.publishedAt : null,
  });

  for (const [index, postId] of (spec.postIds ?? []).entries()) {
    await db.insert(schema.collectionPosts).values({ collectionId, postId, position: index });
  }

  return collectionId;
}
