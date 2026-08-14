import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { persistMediaUpload, updateMediaAsset } from '@/actions/media';
import { createDb, schema } from '@/db/client';
import { findAdminMedia, listAdminMedia } from '@/db/queries/admin-media';

import { validWebp } from '../fixtures/valid-webp';

const webp = () => validWebp();

describe('media uploads', () => {
  it('stores immutable WebP first, then inspected metadata, and lists newest first', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    const result = await persistMediaUpload(db, env.BUCKET, webp(), {
      id,
      altText: 'Captura',
      now: new Date('2026-08-13T12:00:00Z'),
    });
    expect(result).toMatchObject({ id, width: 2, height: 1, contentType: 'image/webp' });
    expect(await env.BUCKET.get(result.r2Key)).not.toBeNull();
    await db.insert(schema.mediaAssets).values([
      { id: 'a', r2Key: 'media/a', contentType: 'image/webp', createdAt: '2020-01-01' },
      { id: 'b', r2Key: 'media/b', contentType: 'image/webp', createdAt: '2020-01-01' },
    ]);
    const listing = await listAdminMedia(db, { limit: 2, offset: 1 });
    expect(listing.total).toBe(3);
    expect(listing.assets.map(({ id }) => id)).toEqual(['a', 'b']);
    expect((await listAdminMedia(db, { limit: 20, offset: 0 })).assets[0]).toMatchObject({
      id,
      altText: 'Captura',
    });
    expect(await findAdminMedia(db, [id, 'missing'])).toEqual([
      expect.objectContaining({ id, altText: 'Captura' }),
    ]);
  });

  it('compensates the R2 object when D1 rejects the row', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db
      .insert(schema.mediaAssets)
      .values({ id, r2Key: `existing/${id}`, contentType: 'image/webp' });
    await expect(
      persistMediaUpload(db, env.BUCKET, webp(), {
        id,
        altText: '',
        now: new Date('2027-01-01T00:00:00Z'),
      })
    ).rejects.toThrow();
    expect(await env.BUCKET.get(`media/2027/01/${id}.webp`)).toBeNull();
  });

  it('creates neither row nor object for invalid data and never overwrites a collision', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await expect(
      persistMediaUpload(db, env.BUCKET, new Uint8Array(30), {
        id,
        altText: 'InvÃ¡lida',
        now: new Date('2028-02-01T00:00:00Z'),
      })
    ).rejects.toThrow('invalid-webp');
    const key = `media/2028/02/${id}.webp`;
    expect(await env.BUCKET.get(key)).toBeNull();
    expect(await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))).toEqual(
      []
    );
    await env.BUCKET.put(key, 'original');
    await expect(
      persistMediaUpload(db, env.BUCKET, webp(), {
        id,
        altText: 'ColisiÃ³n',
        now: new Date('2028-02-01T00:00:00Z'),
      })
    ).rejects.toThrow('media-collision');
    expect(await (await env.BUCKET.get(key))!.text()).toBe('original');
  });

  it('validates and updates canonical metadata', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db
      .insert(schema.mediaAssets)
      .values({ id, r2Key: `media/${id}`, contentType: 'image/webp' });
    await updateMediaAsset(db, { id, decorative: false, altText: 'Mapa', caption: 'Pie' });
    const [row] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
    expect(row).toMatchObject({ altText: 'Mapa', caption: 'Pie' });
    await expect(updateMediaAsset(db, { id, decorative: false, altText: ' ' })).rejects.toThrow();
  });
});
