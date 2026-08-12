import { createPostSchema, type ValidCreatePostInput } from '@/lib/admin-posts';
import { newPostId, newPostLocalizationId } from '@/lib/ids';

import type { Db } from '@/db/client';
const insertPost = `INSERT INTO posts (id, section) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM post_localizations WHERE locale = ? AND slug = ?) AND NOT EXISTS (SELECT 1 FROM post_localization_slug_history WHERE locale = ? AND old_slug = ?)`;
const insertLocalization = `INSERT INTO post_localizations (id, post_id, locale, slug, status) SELECT ?, ?, ?, ?, 'draft' WHERE changes() = 1 AND EXISTS (SELECT 1 FROM posts WHERE id = ?)`;
export function adminPostError(error: unknown, logger: { error: (message: string) => void }) {
  if (error instanceof Error && error.message === 'slug-reserved')
    return { code: 'CONFLICT' as const, message: 'Ese slug ya está reservado.' };
  logger.error(
    `Admin post creation failed: ${error instanceof Error ? error.stack : String(error)}`
  );
  return { code: 'INTERNAL_SERVER_ERROR' as const };
}
export async function createAdminPost(
  db: Db,
  rawInput: ValidCreatePostInput,
  ids: [string, string] = [newPostId(), newPostLocalizationId()]
) {
  const input = createPostSchema.parse(rawInput);
  const [postId, localizationId] = ids;
  const [createdPost, createdLocalization] = await db.$client.batch([
    db.$client
      .prepare(insertPost)
      .bind(postId, input.section, input.locale, input.slug, input.locale, input.slug),
    db.$client
      .prepare(insertLocalization)
      .bind(localizationId, postId, input.locale, input.slug, postId),
  ]);
  if (createdPost.meta.changes === 0 || createdLocalization.meta.changes === 0)
    throw new Error('slug-reserved');
  return { postId, localizationId };
}
