import { and, eq } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { parseContentDoc, type ContentDoc } from '@/lib/content/schema';

import type { EditorLocalizations } from '@/lib/drafts';

const empty: ContentDoc = { type: 'doc', content: [] };
export async function loadEditorLocalizations(db: Db, postId: string) {
  const rows = await db
    .select({ id: schema.postLocalizations.id, locale: schema.postLocalizations.locale })
    .from(schema.postLocalizations)
    .where(eq(schema.postLocalizations.postId, postId));
  return rows.reduce<EditorLocalizations>((options, row) => {
    options[row.locale] = row.id;
    return options;
  }, {});
}
export async function loadEditorDraft(db: Db, postId: string, localizationId: string) {
  const [row] = await db
    .select({ draft: schema.postDrafts, revision: schema.postRevisions })
    .from(schema.postLocalizations)
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postLocalizations.postId))
    .leftJoin(
      schema.postDrafts,
      eq(schema.postDrafts.postLocalizationId, schema.postLocalizations.id)
    )
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(and(eq(schema.posts.id, postId), eq(schema.postLocalizations.id, localizationId)))
    .limit(1);
  if (!row) return null;
  const source = row.draft ?? row.revision;
  return {
    title: source?.title ?? '',
    excerpt: source?.excerpt ?? null,
    contentJson: parseContentDoc(source?.contentJson ?? empty),
    seoTitle: source?.seoTitle ?? null,
    seoDescription: source?.seoDescription ?? null,
    canonicalUrl: source?.canonicalUrl ?? null,
    ogTitle: source?.ogTitle ?? null,
    ogDescription: source?.ogDescription ?? null,
    ogImageMediaId: source?.ogImageMediaId ?? null,
    ogImageAlt: source?.ogImageAlt ?? null,
    draftToken: row.draft?.draftToken ?? null,
  };
}
