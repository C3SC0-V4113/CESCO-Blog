import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { persistMediaUpload, updateMediaAsset } from '@/actions/media';
import { createDb, schema } from '@/db/client';
import { findAdminMedia, listAdminMedia } from '@/db/queries/admin-media';
import { POST } from '@/pages/admin/media/upload';

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

  it('logs a failed compensation by key and still surfaces the D1 error', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db
      .insert(schema.mediaAssets)
      .values({ id, r2Key: `existing/${id}`, contentType: 'image/webp' });
    const cleanup = Error('r2-unavailable');
    const bucket = {
      head: (key: string) => env.BUCKET.head(key),
      put: (key: string, value: Uint8Array, options?: R2PutOptions) =>
        env.BUCKET.put(key, value, options),
      delete: () => Promise.reject(cleanup),
    } as unknown as R2Bucket;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error: unknown = await persistMediaUpload(db, bucket, webp(), {
      id,
      altText: 'Secreto',
      now: new Date('2029-03-01T00:00:00Z'),
    }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBe(cleanup);
    expect(String(error)).toMatch(/media_assets/);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining(`media/2029/03/${id}.webp`)
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('Secreto');
    await env.BUCKET.delete(`media/2029/03/${id}.webp`);
  });

  it('finds more assets than one D1 statement can bind', async () => {
    const db = createDb(env.DB);
    const ids = Array.from({ length: 181 }, () => crypto.randomUUID());
    for (let index = 0; index < ids.length; index += 20)
      await db
        .insert(schema.mediaAssets)
        .values(
          ids
            .slice(index, index + 20)
            .map((id) => ({ id, r2Key: `media/${id}`, contentType: 'image/webp' }))
        );
    const found = await findAdminMedia(db, ids);
    expect(found.map(({ id }) => id).sort()).toEqual([...ids].sort());
  });

  it('answers 400 rather than 500 to an upload with no body', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const url = new URL('http://127.0.0.1:3000/admin/media/upload');
    const request = new Request(url, {
      method: 'POST',
      headers: {
        Origin: url.origin,
        'Content-Type': 'image/webp',
        'X-Cesco-Media-Upload': '1',
        'X-Cesco-Media-Metadata': encodeURIComponent(
          JSON.stringify({ decorative: true, altText: '' })
        ),
      },
    });
    const response = await POST({ request, url } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_MEDIA' });
    expect(log).toHaveBeenCalledOnce();
  });

  it('creates neither row nor object for invalid data and never overwrites a collision', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await expect(
      persistMediaUpload(db, env.BUCKET, new Uint8Array(30), {
        id,
        altText: 'Inválida',
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
        altText: 'Colisión',
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
