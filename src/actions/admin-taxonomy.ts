import { and, eq, inArray, ne } from 'drizzle-orm';

import { drainPendingPurges, recordPendingPurge } from '@/actions/pending-purges';
import { schema, type Db } from '@/db/client';
import {
  authorInputSchema,
  collectionInputSchema,
  createCollectionInputSchema,
  featuredInputSchema,
  seoDraftInputSchema,
  type AuthorInput,
  type CollectionInput,
  type FeaturedInput,
  type SeoDraftInput,
} from '@/lib/admin-taxonomy';
import { toDbTimestamp } from '@/lib/timestamps';

import type { PurgeTags } from '@/actions/publishing';

async function postSurfaceTags(db: Db, postIds: string[]) {
  if (!postIds.length) return [];
  const [posts, collections] = await Promise.all([
    db
      .select({
        id: schema.posts.id,
        section: schema.posts.section,
        locale: schema.postLocalizations.locale,
      })
      .from(schema.posts)
      .leftJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
      .where(inArray(schema.posts.id, postIds)),
    db
      .select({ id: schema.collectionPosts.collectionId })
      .from(schema.collectionPosts)
      .where(inArray(schema.collectionPosts.postId, postIds)),
  ]);
  return [
    ...new Set([
      ...postIds.map((id) => `post-${id}`),
      ...posts.map(({ section }) => `section-${section}`),
      ...posts.flatMap(({ locale }) => (locale ? [`locale-${locale}`] : [])),
      ...collections.map(({ id }) => `collection-${id}`),
      'featured',
      'rss',
      'sitemap',
    ]),
  ];
}

function isUniqueError(error: unknown) {
  let current: unknown = error;
  while (current instanceof Error) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

export async function createAuthor(db: Db, raw: AuthorInput) {
  const input = authorInputSchema.parse(raw);
  try {
    await db.insert(schema.authors).values(input);
  } catch (error) {
    if (isUniqueError(error)) throw Error('author-slug-reserved');
    throw error;
  }
  return input;
}

export async function updateAuthor(db: Db, raw: AuthorInput, purge: PurgeTags) {
  const input = authorInputSchema.parse(raw);
  const postIds = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(eq(schema.posts.authorId, input.id));
  // The byline renders on every page of the author's posts.
  const tags = await postSurfaceTags(
    db,
    postIds.map(({ id }) => id)
  );
  const statements = [
    db.$client
      .prepare(
        `UPDATE authors SET slug = ?, name = ?, bio = ?, avatar_media_id = ?, website_url = ?, same_as = ?, updated_at = ?
WHERE id = ?`
      )
      .bind(
        input.slug,
        input.name,
        input.bio,
        input.avatarMediaId,
        input.websiteUrl,
        JSON.stringify(input.sameAs),
        toDbTimestamp(),
        input.id
      ),
    ...(tags.length ? [recordPendingPurge(db, tags, 'author', 'changes() = 1')] : []),
  ];
  let results: D1Result[];
  try {
    results = await db.$client.batch(statements);
  } catch (error) {
    if (isUniqueError(error)) throw Error('author-slug-reserved');
    throw error;
  }
  if (results[0]!.meta.changes !== 1) throw Error('author-not-found');
  if (tags.length && !(await drainPendingPurges(db, purge)))
    return { ...input, status: 'saved-with-cache-warning' as const };
  return { ...input, status: 'saved' as const };
}

// Collections keep no slug history, so a published slug must never change
// (ADR-0010, ADR-0012).
function changesLockedSlug(
  rows: Array<{ locale: string; slug: string; firstPublishedAt: string | null }>,
  localizations: Array<{ locale: string; slug: string }>
) {
  return localizations.some(({ locale, slug }) =>
    rows.some((row) => row.locale === locale && row.firstPublishedAt !== null && row.slug !== slug)
  );
}

export async function createCollection(db: Db, raw: { id: string }) {
  const { id } = createCollectionInputSchema.parse(raw);
  await db.insert(schema.collections).values({ id });
  return { id };
}

export async function saveCollection(
  db: Db,
  raw: CollectionInput,
  purge: PurgeTags,
  date: Date = new Date()
) {
  const input = collectionInputSchema.parse(raw);
  const [current, oldMemberships, existingPosts, taken] = await Promise.all([
    db
      .select()
      .from(schema.collectionLocalizations)
      .where(eq(schema.collectionLocalizations.collectionId, input.id)),
    db
      .select({ postId: schema.collectionPosts.postId })
      .from(schema.collectionPosts)
      .where(eq(schema.collectionPosts.collectionId, input.id)),
    input.postIds.length
      ? db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(inArray(schema.posts.id, input.postIds))
      : Promise.resolve([]),
    db
      .select({
        locale: schema.collectionLocalizations.locale,
        slug: schema.collectionLocalizations.slug,
      })
      .from(schema.collectionLocalizations)
      .where(
        and(
          inArray(
            schema.collectionLocalizations.slug,
            input.localizations.map(({ slug }) => slug)
          ),
          ne(schema.collectionLocalizations.collectionId, input.id)
        )
      ),
  ]);
  if (existingPosts.length !== input.postIds.length) throw Error('collection-post-not-found');
  if (changesLockedSlug(current, input.localizations)) throw Error('collection-slug-locked');
  // A slug is unique per locale across every collection, so a collision is a
  // conflict to report rather than a write to attempt.
  if (
    taken.some((row) =>
      input.localizations.some(({ locale, slug }) => row.locale === locale && row.slug === slug)
    )
  )
    throw Error('collection-slug-reserved');
  const affectedPosts = new Set([...oldMemberships.map(({ postId }) => postId), ...input.postIds]);
  const timestamp = toDbTimestamp(date);
  const statements = [
    db.$client
      .prepare(`UPDATE collections SET editorial_state = ?, updated_at = ? WHERE id = ?`)
      .bind(input.editorialState, timestamp, input.id),
    ...input.localizations.flatMap((localization) => {
      const statement = db.$client
        .prepare(
          `INSERT INTO collection_localizations (id, collection_id, locale, slug, title, description, status, first_published_at, updated_at)
SELECT ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN ? ELSE NULL END, ?
WHERE true
ON CONFLICT(collection_id, locale) DO UPDATE SET slug = excluded.slug, title = excluded.title,
description = excluded.description, status = excluded.status,
first_published_at = COALESCE(collection_localizations.first_published_at, excluded.first_published_at),
updated_at = excluded.updated_at
WHERE collection_localizations.id = excluded.id
AND (collection_localizations.first_published_at IS NULL OR collection_localizations.slug = excluded.slug)`
        )
        .bind(
          localization.id,
          input.id,
          localization.locale,
          localization.slug,
          localization.title,
          localization.description,
          localization.status,
          localization.status,
          timestamp,
          timestamp
        );
      // A slug another collection took after the check above fails the
      // (locale, slug) UNIQUE index, which names the conflict. A published slug
      // or a foreign id instead leaves the upsert at zero rows, and that must
      // abort the whole batch; otherwise another localization or the
      // membership rewrite could commit beside it.
      const guard = db.$client.prepare(
        `INSERT INTO collection_posts (collection_id, post_id, position)
SELECT NULL, NULL, NULL WHERE changes() <> 1`
      );
      return [statement, guard];
    }),
    db.$client.prepare(`DELETE FROM collection_posts WHERE collection_id = ?`).bind(input.id),
    ...(input.postIds.length
      ? [
          db.$client
            .prepare(
              `INSERT INTO collection_posts (collection_id, post_id, position)
SELECT ?, value, CAST(key AS INTEGER) FROM json_each(?)`
            )
            .bind(input.id, JSON.stringify(input.postIds)),
        ]
      : []),
    // Series pages list every member and each member shows its series, so a
    // member that just left must refresh too.
    recordPendingPurge(
      db,
      [`collection-${input.id}`, 'series', ...[...affectedPosts].map((postId) => `post-${postId}`)],
      'collection',
      'EXISTS (SELECT 1 FROM collections WHERE id = ?)',
      input.id
    ),
  ];
  try {
    const results = await db.$client.batch(statements);
    if (results[0]!.meta.changes !== 1) throw Error('collection-not-found');
  } catch (error) {
    if (isUniqueError(error)) throw Error('collection-slug-reserved');
    // The guard aborts without saying why. Read again rather than trust the
    // check above: a publish may have landed between the two.
    const now = await db
      .select()
      .from(schema.collectionLocalizations)
      .where(eq(schema.collectionLocalizations.collectionId, input.id));
    if (changesLockedSlug(now, input.localizations)) throw Error('collection-slug-locked');
    throw error;
  }
  return (await drainPendingPurges(db, purge))
    ? { status: 'saved' as const }
    : { status: 'saved-with-cache-warning' as const };
}

export async function setFeaturedLocalization(
  db: Db,
  raw: FeaturedInput,
  purge: PurgeTags,
  date: Date = new Date()
) {
  const input = featuredInputSchema.parse(raw);
  const [source] = await db
    .select({
      locale: schema.postLocalizations.locale,
      status: schema.postLocalizations.status,
      revisionId: schema.postLocalizations.publishedRevisionId,
      editorialState: schema.posts.editorialState,
    })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .where(eq(schema.postLocalizations.id, input.localizationId));
  if (!source) throw Error('localization-not-found');
  if (
    input.featured &&
    (source.status !== 'published' || !source.revisionId || source.editorialState !== 'active')
  )
    throw Error('feature-not-publishable');
  const timestamp = toDbTimestamp(date);
  if (input.featured) {
    const [featured] = await db.$client.batch([
      db.$client
        .prepare(
          `UPDATE post_localizations SET featured_at = ?, updated_at = ?
WHERE id = ? AND status = 'published' AND published_revision_id IS NOT NULL
AND EXISTS (SELECT 1 FROM posts WHERE id = post_localizations.post_id AND editorial_state = 'active')`
        )
        .bind(timestamp, timestamp, input.localizationId),
      db.$client
        .prepare(
          `UPDATE post_localizations SET featured_at = NULL, updated_at = ?
WHERE locale = ? AND id <> ? AND featured_at IS NOT NULL
AND EXISTS (SELECT 1 FROM post_localizations chosen WHERE chosen.id = ? AND chosen.featured_at = ?)`
        )
        .bind(timestamp, source.locale, input.localizationId, input.localizationId, timestamp),
      recordPendingPurge(
        db,
        ['featured'],
        'feature',
        'EXISTS (SELECT 1 FROM post_localizations WHERE id = ? AND featured_at = ?)',
        input.localizationId,
        timestamp
      ),
    ]);
    if (featured.meta.changes !== 1) throw Error('feature-not-publishable');
  } else {
    await db.$client.batch([
      db.$client
        .prepare(
          `UPDATE post_localizations SET featured_at = NULL, updated_at = ? WHERE id = ? AND featured_at IS NOT NULL`
        )
        .bind(timestamp, input.localizationId),
      recordPendingPurge(db, ['featured'], 'feature', 'changes() = 1'),
    ]);
  }
  const status = input.featured ? ('featured' as const) : ('unfeatured' as const);
  return (await drainPendingPurges(db, purge))
    ? { status }
    : { status: 'featured-with-cache-warning' as const };
}

const livePublication = (db: Db, postId: string) =>
  db
    .select({ id: schema.postLocalizations.id })
    .from(schema.postLocalizations)
    .where(
      and(
        eq(schema.postLocalizations.postId, postId),
        eq(schema.postLocalizations.status, 'published')
      )
    )
    .limit(1);

export async function saveSeoDraft(db: Db, raw: SeoDraftInput, purge: PurgeTags) {
  const input = seoDraftInputSchema.parse(raw);
  const [[post], author, cover, ogImage, published] = await Promise.all([
    db
      .select({
        id: schema.posts.id,
        section: schema.posts.section,
        authorId: schema.posts.authorId,
        coverMediaId: schema.posts.coverMediaId,
        status: schema.postLocalizations.status,
      })
      .from(schema.posts)
      .innerJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
      .where(
        and(
          eq(schema.posts.id, input.postId),
          eq(schema.postLocalizations.id, input.localizationId)
        )
      )
      .limit(1),
    input.authorId
      ? db
          .select({ id: schema.authors.id })
          .from(schema.authors)
          .where(eq(schema.authors.id, input.authorId))
      : Promise.resolve([]),
    input.coverMediaId
      ? db
          .select({ id: schema.mediaAssets.id })
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, input.coverMediaId))
      : Promise.resolve([]),
    input.ogImageMediaId
      ? db
          .select({ id: schema.mediaAssets.id })
          .from(schema.mediaAssets)
          .where(eq(schema.mediaAssets.id, input.ogImageMediaId))
      : Promise.resolve([]),
    livePublication(db, input.postId),
  ]);
  if (!post) throw Error('draft-not-found');
  if (input.authorId && !author.length) throw Error('author-not-found');
  if (input.coverMediaId && !cover.length) throw Error('cover-not-found');
  if (input.ogImageMediaId && !ogImage.length) throw Error('og-image-not-found');
  // Publishing requires the cover (ADR-0015), so a post that is live in any
  // locale cannot lose it.
  if (!input.coverMediaId && published.length) throw Error('cover-required-while-published');
  const seoValues = [
    input.seoTitle,
    input.seoDescription,
    input.ogTitle,
    input.ogDescription,
    input.ogImageMediaId,
    input.ogImageAlt,
    input.nextToken,
  ];
  // Repeated inside the write, because a publish can land after the check above.
  const coverGuard = `(? IS NOT NULL OR NOT EXISTS (SELECT 1 FROM post_localizations WHERE post_id = ? AND status = 'published'))`;
  // The editor's autosave shares this row and its token, so neither can
  // overwrite the other unseen. A stored `nextToken` means this attempt already
  // landed and only its response was lost, so it is accepted as a replay
  // (ADR-0035).
  const save =
    input.draftToken !== null
      ? db.$client
          .prepare(
            `UPDATE post_drafts SET seo_title = ?, seo_description = ?, og_title = ?, og_description = ?,
og_image_media_id = ?, og_image_alt = ?, draft_token = ?, updated_at = CURRENT_TIMESTAMP
WHERE post_localization_id = ? AND draft_token IN (?, ?)
AND EXISTS (SELECT 1 FROM post_localizations WHERE id = ? AND post_id = ?) AND ${coverGuard}`
          )
          .bind(
            ...seoValues,
            input.localizationId,
            input.draftToken,
            input.nextToken,
            input.localizationId,
            input.postId,
            input.coverMediaId,
            input.postId
          )
      : db.$client
          .prepare(
            `INSERT INTO post_drafts (post_localization_id, title, excerpt, content_json, seo_title, seo_description,
og_title, og_description, og_image_media_id, og_image_alt, draft_token)
SELECT l.id, COALESCE(r.title, ''), r.excerpt, COALESCE(r.content_json, '{"type":"doc","content":[]}'), ?, ?, ?, ?, ?, ?, ?
FROM post_localizations l LEFT JOIN post_revisions r ON r.id = l.published_revision_id
WHERE l.id = ? AND l.post_id = ? AND ${coverGuard}
ON CONFLICT(post_localization_id) DO UPDATE SET seo_title = excluded.seo_title,
seo_description = excluded.seo_description, og_title = excluded.og_title,
og_description = excluded.og_description, og_image_media_id = excluded.og_image_media_id,
og_image_alt = excluded.og_image_alt, updated_at = CURRENT_TIMESTAMP
WHERE post_drafts.draft_token = excluded.draft_token`
          )
          .bind(...seoValues, input.localizationId, input.postId, input.coverMediaId, input.postId);
  // Cover and byline are live on published pages; the SEO fields wait for the
  // next publish, which purges on its own.
  const surfaceChanged =
    post.coverMediaId !== input.coverMediaId || post.authorId !== input.authorId;
  const tags = surfaceChanged && published.length ? await postSurfaceTags(db, [input.postId]) : [];
  const [saved] = await db.$client.batch([
    save,
    db.$client
      .prepare(
        `UPDATE posts SET cover_media_id = ?, author_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND changes() = 1`
      )
      .bind(input.coverMediaId, input.authorId, input.postId),
    ...(tags.length ? [recordPendingPurge(db, tags, 'surface', 'changes() = 1')] : []),
  ]);
  if (saved.meta.changes !== 1) {
    // Either guard can refuse; only a fresh read tells which one did.
    if (!input.coverMediaId && (await livePublication(db, input.postId)).length)
      throw Error('cover-required-while-published');
    throw Error('draft-conflict');
  }
  if (tags.length && !(await drainPendingPurges(db, purge)))
    return { status: 'saved-with-cache-warning' as const, draftToken: input.nextToken };
  return { status: 'saved' as const, draftToken: input.nextToken };
}
