import { asc, desc, inArray, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';

export type AdminMediaAsset = typeof schema.mediaAssets.$inferSelect;

export async function listAdminMedia(db: Db, page: { limit: number; offset: number }) {
  const [assets, [count]] = await Promise.all([
    db
      .select()
      .from(schema.mediaAssets)
      .orderBy(desc(schema.mediaAssets.createdAt), asc(schema.mediaAssets.id))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: sql<number>`count(*)` }).from(schema.mediaAssets),
  ]);
  return { assets, total: count?.total ?? 0 };
}

export function findAdminMedia(db: Db, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, ids));
}
