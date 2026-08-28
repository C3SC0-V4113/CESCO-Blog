import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createDb, schema } from '@/db/client';
import { listReviewQueue } from '@/db/queries/admin-review';

const id = (kind: number, value: number) =>
  `${kind.toString().padStart(8, '0')}-0000-4000-8000-${value.toString().padStart(12, '0')}`;

describe('admin review queue', () => {
  it('returns stable page metadata and every localization beyond the first 50', async () => {
    const db = createDb(env.DB);
    const rows = Array.from({ length: 51 }, (_, index) => ({
      postId: id(1, index),
      localizationId: id(2, index),
      title: `Review ${index.toString().padStart(2, '0')}`,
    }));
    for (let start = 0; start < rows.length; start += 20) {
      const batch = rows.slice(start, start + 20);
      await db
        .insert(schema.posts)
        .values(batch.map(({ postId }) => ({ id: postId, section: 'analysis' as const })));
      await db.insert(schema.postLocalizations).values(
        batch.map(({ postId, localizationId, title }) => ({
          id: localizationId,
          postId,
          locale: 'es' as const,
          slug: title.toLowerCase().replace(' ', '-'),
        }))
      );
      await db.insert(schema.postDrafts).values(
        batch.map(({ localizationId, title }) => ({
          postLocalizationId: localizationId,
          title,
          contentJson: { type: 'doc' as const, content: [] },
          draftToken: `token-${title}`,
          updatedAt: '2026-08-14 12:00:00',
        }))
      );
    }

    const first = await listReviewQueue(db, '1', 50);
    const second = await listReviewQueue(db, '999', 50);
    expect(first).toMatchObject({ total: 51, page: 1, lastPage: 2, items: { length: 50 } });
    expect(first.items[0]?.localizationId).toBe(id(2, 0));
    expect(second).toMatchObject({
      total: 51,
      requestedPage: 999,
      page: 2,
      lastPage: 2,
      items: [{ localizationId: id(2, 50) }],
    });
  });
});
