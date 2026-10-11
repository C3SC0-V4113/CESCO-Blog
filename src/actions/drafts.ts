import { and, eq, exists, or, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { saveDraftSchema, type SaveDraftInput } from '@/lib/drafts';

export async function saveDraft(db: Db, raw: SaveDraftInput) {
  const input = saveDraftSchema.parse(raw);
  const [localization] = await db
    .select({ publishedRevisionId: schema.postLocalizations.publishedRevisionId })
    .from(schema.postLocalizations)
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
    draftToken: input.nextToken,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };
  // A stored `nextToken` means this attempt already landed and only its response
  // was lost. The client replays an attempt with its original content alone, so
  // accepting it rewrites what the row already holds (ADR-0035).
  const sameAttempt = eq(schema.postDrafts.draftToken, input.nextToken);
  const bumpPostTimestamp = () =>
    db
      .update(schema.posts)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(schema.posts.id, input.postId),
          exists(
            db
              .select({ postLocalizationId: schema.postDrafts.postLocalizationId })
              .from(schema.postDrafts)
              .where(
                and(eq(schema.postDrafts.postLocalizationId, input.localizationId), sameAttempt)
              )
          )
        )
      )
      .returning({ id: schema.posts.id });
  if (input.draftToken !== null) {
    const [updated] = await db.batch([
      db
        .update(schema.postDrafts)
        .set(values)
        .where(
          and(
            eq(schema.postDrafts.postLocalizationId, input.localizationId),
            or(eq(schema.postDrafts.draftToken, input.draftToken), sameAttempt)
          )
        )
        .returning({ token: schema.postDrafts.draftToken }),
      bumpPostTimestamp(),
    ]);
    if (!updated.length) throw Error('draft-conflict');
    return { draftToken: input.nextToken };
  }
  // Only a new draft inherits the published SEO and social fields, so the
  // revision is read here and never on the autosave path above.
  const [published] = localization.publishedRevisionId
    ? await db
        .select({
          seoTitle: schema.postRevisions.seoTitle,
          seoDescription: schema.postRevisions.seoDescription,
          canonicalUrl: schema.postRevisions.canonicalUrl,
          ogTitle: schema.postRevisions.ogTitle,
          ogDescription: schema.postRevisions.ogDescription,
          ogImageMediaId: schema.postRevisions.ogImageMediaId,
          ogImageAlt: schema.postRevisions.ogImageAlt,
        })
        .from(schema.postRevisions)
        .where(eq(schema.postRevisions.id, localization.publishedRevisionId))
    : [];
  const [inserted] = await db.batch([
    db
      .insert(schema.postDrafts)
      .values({ postLocalizationId: input.localizationId, ...values, ...published })
      .onConflictDoUpdate({
        target: schema.postDrafts.postLocalizationId,
        set: values,
        setWhere: sameAttempt,
      })
      .returning({ token: schema.postDrafts.draftToken }),
    bumpPostTimestamp(),
  ]);
  if (!inserted.length) throw Error('draft-conflict');
  return { draftToken: input.nextToken };
}
