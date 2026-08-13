import { asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
export type AdminLocaleStatus = 'missing' | 'draft' | 'published' | 'archived';
export type AdminPostSummary = {
  id: string;
  section: 'analysis' | 'opinion';
  editorialState: 'active' | 'archived';
  displayName: string;
  updatedAt: string;
  locales: Record<'es' | 'en', AdminLocaleStatus>;
  localizationIds: Partial<Record<'es' | 'en', string>>;
};
export async function listAdminPosts(
  db: Db,
  criteria: { limit: number; offset: number }
): Promise<{ posts: AdminPostSummary[]; total: number }> {
  const [aggregates, [counted]] = await Promise.all([
    db
      .select({
        id: schema.posts.id,
        section: schema.posts.section,
        editorialState: schema.posts.editorialState,
        updatedAt: schema.posts.updatedAt,
      })
      .from(schema.posts)
      .orderBy(desc(schema.posts.updatedAt), asc(schema.posts.id))
      .limit(criteria.limit)
      .offset(criteria.offset),
    db.select({ total: sql<number>`count(*)` }).from(schema.posts),
  ]);
  if (aggregates.length === 0) return { posts: [], total: counted?.total ?? 0 };
  const postIds = aggregates.map(({ id }) => id);
  const localizations = await db
    .select({
      postId: schema.postLocalizations.postId,
      locale: schema.postLocalizations.locale,
      localizationId: schema.postLocalizations.id,
      slug: schema.postLocalizations.slug,
      status: schema.postLocalizations.status,
      publishedTitle: schema.postRevisions.title,
    })
    .from(schema.postLocalizations)
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(inArray(schema.postLocalizations.postId, postIds));
  return {
    total: counted?.total ?? 0,
    posts: aggregates.map((aggregate) => {
      const rows = localizations.filter(({ postId }) => postId === aggregate.id);
      const display =
        rows.find(({ locale, publishedTitle }) => locale === 'es' && publishedTitle)
          ?.publishedTitle ??
        rows.find(({ publishedTitle }) => publishedTitle)?.publishedTitle ??
        rows.find(({ locale }) => locale === 'es')?.slug ??
        rows[0]?.slug ??
        aggregate.id;
      return {
        ...aggregate,
        displayName: display,
        locales: {
          es: rows.find(({ locale }) => locale === 'es')?.status ?? 'missing',
          en: rows.find(({ locale }) => locale === 'en')?.status ?? 'missing',
        },
        localizationIds: Object.fromEntries(
          rows.map(({ locale, localizationId }) => [locale, localizationId])
        ),
      };
    }),
  };
}
