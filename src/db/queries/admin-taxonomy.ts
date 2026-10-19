import { asc, desc, eq } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { parseContentDoc } from '@/lib/content/schema';

export type AdminAuthor = typeof schema.authors.$inferSelect;

export function listAdminAuthors(db: Db) {
  return db.select().from(schema.authors).orderBy(asc(schema.authors.name), asc(schema.authors.id));
}

export async function listAdminCollections(db: Db) {
  const [collections, localizations] = await Promise.all([
    db.select().from(schema.collections).orderBy(desc(schema.collections.updatedAt)),
    db
      .select()
      .from(schema.collectionLocalizations)
      .orderBy(asc(schema.collectionLocalizations.locale)),
  ]);
  return collections.map((collection) => ({
    id: collection.id,
    editorialState: collection.editorialState,
    localizations: localizations.filter(({ collectionId }) => collectionId === collection.id),
  }));
}

export type AdminCollectionSummary = Awaited<ReturnType<typeof listAdminCollections>>[number];

export async function loadAdminCollection(db: Db, id: string) {
  const [[collection], localizations, memberships] = await Promise.all([
    db.select().from(schema.collections).where(eq(schema.collections.id, id)).limit(1),
    db
      .select()
      .from(schema.collectionLocalizations)
      .where(eq(schema.collectionLocalizations.collectionId, id))
      .orderBy(asc(schema.collectionLocalizations.locale)),
    db
      .select({ postId: schema.collectionPosts.postId })
      .from(schema.collectionPosts)
      .where(eq(schema.collectionPosts.collectionId, id))
      .orderBy(asc(schema.collectionPosts.position)),
  ]);
  return collection
    ? { ...collection, localizations, postIds: memberships.map(({ postId }) => postId) }
    : null;
}

export type AdminCollectionDetail = NonNullable<Awaited<ReturnType<typeof loadAdminCollection>>>;

export async function listAdminMembershipPosts(db: Db) {
  const rows = await db
    .select({
      id: schema.posts.id,
      section: schema.posts.section,
      locale: schema.postLocalizations.locale,
      slug: schema.postLocalizations.slug,
      status: schema.postLocalizations.status,
      draftTitle: schema.postDrafts.title,
      publishedTitle: schema.postRevisions.title,
    })
    .from(schema.posts)
    .leftJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
    .leftJoin(
      schema.postDrafts,
      eq(schema.postDrafts.postLocalizationId, schema.postLocalizations.id)
    )
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .orderBy(desc(schema.posts.updatedAt), asc(schema.posts.id));
  const grouped = new Map<string, AdminMembershipPost>();
  for (const row of rows) {
    const post = grouped.get(row.id) ?? {
      id: row.id,
      section: row.section,
      title: row.id,
      localizations: [],
    };
    if (row.locale) {
      const title = row.draftTitle || row.publishedTitle || row.slug || row.id;
      post.localizations.push({ locale: row.locale, status: row.status!, title });
      if (row.locale === 'es' || post.title === row.id) post.title = title;
    }
    grouped.set(row.id, post);
  }
  return [...grouped.values()];
}

export type AdminMembershipPost = {
  id: string;
  section: 'analysis' | 'opinion';
  title: string;
  localizations: Array<{
    locale: 'es' | 'en';
    status: 'draft' | 'published' | 'archived';
    title: string;
  }>;
};

export async function loadAdminSeo(db: Db, postId: string, localizationId: string) {
  const [row] = await db
    .select({
      postId: schema.posts.id,
      localizationId: schema.postLocalizations.id,
      locale: schema.postLocalizations.locale,
      slug: schema.postLocalizations.slug,
      section: schema.posts.section,
      authorId: schema.posts.authorId,
      coverMediaId: schema.posts.coverMediaId,
      draft: schema.postDrafts,
      revision: schema.postRevisions,
    })
    .from(schema.posts)
    .innerJoin(schema.postLocalizations, eq(schema.postLocalizations.postId, schema.posts.id))
    .leftJoin(
      schema.postDrafts,
      eq(schema.postDrafts.postLocalizationId, schema.postLocalizations.id)
    )
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(eq(schema.postLocalizations.id, localizationId))
    .limit(1);
  if (!row || row.postId !== postId) return null;
  const source = row.draft ?? row.revision;
  return {
    postId: row.postId,
    localizationId: row.localizationId,
    locale: row.locale,
    slug: row.slug,
    section: row.section,
    authorId: row.authorId,
    coverMediaId: row.coverMediaId,
    title: source?.title ?? '',
    excerpt: source?.excerpt ?? null,
    contentJson: parseContentDoc(source?.contentJson ?? { type: 'doc', content: [] }),
    draftToken: row.draft?.draftToken ?? null,
    seoTitle: source?.seoTitle ?? null,
    seoDescription: source?.seoDescription ?? null,
    ogTitle: source?.ogTitle ?? null,
    ogDescription: source?.ogDescription ?? null,
    ogImageMediaId: source?.ogImageMediaId ?? null,
    ogImageAlt: source?.ogImageAlt ?? null,
  };
}

export type AdminSeoState = NonNullable<Awaited<ReturnType<typeof loadAdminSeo>>>;
