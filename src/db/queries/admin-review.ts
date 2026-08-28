import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { parseContentDoc } from '@/lib/content/schema';
import { mediaAssetIds } from '@/lib/media';
import { clampPageWindow } from '@/lib/pagination';

export type ReviewQueueItem = {
  postId: string;
  localizationId: string;
  locale: 'es' | 'en';
  slug: string;
  status: 'draft' | 'published' | 'archived';
  section: 'analysis' | 'opinion';
  title: string;
  draftToken: string | null;
  coverReady: boolean;
};

const publicationSelection = {
  postId: schema.posts.id,
  localizationId: schema.postLocalizations.id,
  locale: schema.postLocalizations.locale,
  slug: schema.postLocalizations.slug,
  status: schema.postLocalizations.status,
  section: schema.posts.section,
  editorialState: schema.posts.editorialState,
  publishedRevisionId: schema.postLocalizations.publishedRevisionId,
  firstPublishedAt: schema.postLocalizations.firstPublishedAt,
  coverMediaId: schema.posts.coverMediaId,
  coverAssetId: schema.mediaAssets.id,
  title: schema.postDrafts.title,
  excerpt: schema.postDrafts.excerpt,
  contentJson: schema.postDrafts.contentJson,
  seoTitle: schema.postDrafts.seoTitle,
  seoDescription: schema.postDrafts.seoDescription,
  canonicalUrl: schema.postDrafts.canonicalUrl,
  ogTitle: schema.postDrafts.ogTitle,
  ogDescription: schema.postDrafts.ogDescription,
  ogImageMediaId: schema.postDrafts.ogImageMediaId,
  ogImageAlt: schema.postDrafts.ogImageAlt,
  draftToken: schema.postDrafts.draftToken,
};

export async function loadPublicationSource(db: Db, postId: string, localizationId: string) {
  const [row] = await db
    .select(publicationSelection)
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .leftJoin(schema.postDrafts, eq(schema.postDrafts.postLocalizationId, localizationId))
    .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
    .where(and(eq(schema.posts.id, postId), eq(schema.postLocalizations.id, localizationId)))
    .limit(1);
  return row ?? null;
}

export async function findPublicationMedia(db: Db, ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, ids));
}

export async function listReviewQueue(db: Db, pageParam: string | null, limit = 50) {
  const [count] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .where(eq(schema.posts.editorialState, 'active'));
  const page = clampPageWindow(pageParam, count?.total ?? 0, limit);
  const rows = await db
    .select(publicationSelection)
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .leftJoin(
      schema.postDrafts,
      eq(schema.postDrafts.postLocalizationId, schema.postLocalizations.id)
    )
    .leftJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.posts.coverMediaId))
    .where(eq(schema.posts.editorialState, 'active'))
    .orderBy(desc(schema.postDrafts.updatedAt), asc(schema.postLocalizations.id))
    .limit(page.limit)
    .offset(page.offset);
  const items: ReviewQueueItem[] = rows.map((row) => ({
    postId: row.postId,
    localizationId: row.localizationId,
    locale: row.locale,
    slug: row.slug,
    status: row.status,
    section: row.section,
    title: row.title || row.slug,
    draftToken: row.draftToken,
    coverReady: row.coverMediaId !== null && row.coverAssetId !== null,
  }));
  return { items, total: count?.total ?? 0, ...page };
}

export async function loadReviewDetail(db: Db, postId: string, localizationId: string) {
  const source = await loadPublicationSource(db, postId, localizationId);
  if (!source) return null;
  const content = parseContentDoc(source.contentJson ?? { type: 'doc', content: [] });
  const ids = mediaAssetIds(content);
  const assets = ids.length
    ? await db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, ids))
    : [];
  return { ...source, contentJson: content, referencedMedia: assets };
}

export type ReviewDetail = NonNullable<Awaited<ReturnType<typeof loadReviewDetail>>>;
