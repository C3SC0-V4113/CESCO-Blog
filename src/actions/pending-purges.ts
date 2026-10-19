import { asc, sql } from 'drizzle-orm';

import { schema, type Db } from '@/db/client';
import { chunkPurgeTags } from '@/lib/cache-tags';

import type { PurgeTags } from '@/actions/publishing';

export type PurgeAction = (typeof schema.pendingCachePurges.$inferSelect)['action'];

const { pendingCachePurges } = schema;

// One JSON parameter rather than one per id: D1 caps bound parameters per
// statement, and a long outage can leave more rows than that.
const idIn = (ids: string[]) =>
  sql`${pendingCachePurges.id} IN (SELECT value FROM json_each(${JSON.stringify(ids)}))`;

/**
 * The statement that records a change's tags, for the change's own batch.
 * `condition` must hold only when the change applied, so a lost race owes
 * nothing. Recording before purging, rather than after a failure, is what
 * survives a Worker that dies between the commit and the purge.
 */
export function recordPendingPurge(
  db: Db,
  tags: string[],
  action: PurgeAction,
  condition: string,
  ...params: unknown[]
): D1PreparedStatement {
  return db.$client
    .prepare(
      `INSERT INTO pending_cache_purges (id, tags, action) SELECT ?, ?, ? WHERE ${condition}`
    )
    .bind(crypto.randomUUID(), JSON.stringify(tags), action, ...params);
}

/**
 * Purges every pending tag set and deletes the rows it fully covered. Resolves
 * to whether nothing is still owed. It never throws: the change that called it
 * has already committed, and reporting it as failed would invite a duplicate
 * (ADR-0037).
 */
export async function drainPendingPurges(db: Db, purge: PurgeTags): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: pendingCachePurges.id, tags: pendingCachePurges.tags })
      .from(pendingCachePurges)
      .orderBy(asc(pendingCachePurges.createdAt), asc(pendingCachePurges.id));
    // Each tag lands in exactly one request, so the requests are independent:
    // they settle together, and a rejected one only keeps the rows that
    // carry its tags.
    const settled = await Promise.allSettled(
      chunkPurgeTags(rows.flatMap(({ tags }) => tags)).map(async (chunk) => {
        await purge(chunk);
        return chunk;
      })
    );
    const purged = new Set(
      settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    );
    const rejected = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    const done: string[] = [];
    const left: string[] = [];
    for (const { id, tags } of rows) (tags.every((tag) => purged.has(tag)) ? done : left).push(id);
    if (done.length) await db.delete(pendingCachePurges).where(idIn(done));
    if (!rejected) return true;
    console.error('Cache purge failed; its tags stay pending', rejected.reason);
    await db
      .update(pendingCachePurges)
      .set({
        attempts: sql`${pendingCachePurges.attempts} + 1`,
        lastError:
          rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason),
      })
      .where(idIn(left));
    return false;
  } catch (error) {
    console.error('Pending cache purges could not be drained', error);
    return false;
  }
}

export async function retryPendingPurges(db: Db, purge: PurgeTags) {
  return (await drainPendingPurges(db, purge))
    ? { status: 'purged' as const }
    : { status: 'pending' as const };
}
