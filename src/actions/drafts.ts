import { and, eq, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { saveDraftSchema, type SaveDraftInput } from '@/lib/drafts';

export async function saveDraft(
  db: Db,
  raw: SaveDraftInput,
  nextToken: string = crypto.randomUUID()
) {
  const input = saveDraftSchema.parse(raw);
  const [localization] = await db
    .select({ id: schema.postLocalizations.id, revision: schema.postRevisions })
    .from(schema.postLocalizations)
    .leftJoin(
      schema.postRevisions,
      eq(schema.postRevisions.id, schema.postLocalizations.publishedRevisionId)
    )
    .where(
      and(
        eq(schema.postLocalizations.id, input.localizationId),
        eq(schema.postLocalizations.postId, input.postId)
      )
    );
  if (!localization) throw Error('draft-not-found');
  const values = {
    title: input.title,
    excerpt: input.excerpt,
    contentJson: input.contentJson,
    draftToken: nextToken,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  if (input.draftToken === null) {
    const revision = localization.revision;
    const inserted = await db
      .insert(schema.postDrafts)
      .values({
        postLocalizationId: input.localizationId,
        ...values,
        seoTitle: revision?.seoTitle,
        seoDescription: revision?.seoDescription,
        canonicalUrl: revision?.canonicalUrl,
        ogTitle: revision?.ogTitle,
        ogDescription: revision?.ogDescription,
        ogImageMediaId: revision?.ogImageMediaId,
        ogImageAlt: revision?.ogImageAlt,
      })
      .onConflictDoNothing()
      .returning({ token: schema.postDrafts.draftToken });
    if (!inserted.length) throw Error('draft-conflict');
  } else {
    const updated = await db
      .update(schema.postDrafts)
      .set(values)
      .where(
        and(
          eq(schema.postDrafts.postLocalizationId, input.localizationId),
          eq(schema.postDrafts.draftToken, input.draftToken)
        )
      )
      .returning({ token: schema.postDrafts.draftToken });
    if (!updated.length) throw Error('draft-conflict');
  }
  return { draftToken: nextToken };
}
