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

// D1 binds at most 100 parameters per statement, and a draft may reference more
// assets than that; the margin leaves room for a filter added later.
const LOOKUP_BATCH = 90;

export async function findAdminMedia(db: Db, ids: string[]) {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += LOOKUP_BATCH)
    batches.push(ids.slice(index, index + LOOKUP_BATCH));
  const rows = await Promise.all(
    batches.map((batch) =>
      db.select().from(schema.mediaAssets).where(inArray(schema.mediaAssets.id, batch))
    )
  );
  return rows.flat();
}
