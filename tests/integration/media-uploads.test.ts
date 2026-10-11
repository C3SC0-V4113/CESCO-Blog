import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { persistMediaUpload, updateMediaAsset } from '@/actions/media';
import { createDb, schema } from '@/db/client';
import { findAdminMedia, listAdminMedia } from '@/db/queries/admin-media';
import { POST } from '@/pages/admin/media/upload';

import { validWebp } from '../fixtures/valid-webp';

const webp = () => validWebp();

const webpChunk = (kind: string, data: number[]) => {
  const bytes = new Uint8Array(8 + data.length + (data.length & 1));
  bytes.set(new TextEncoder().encode(kind));
  new DataView(bytes.buffer).setUint32(4, data.length, true);
  bytes.set(data, 8);
  return bytes;
};

const webpWithChunks = (chunks: Uint8Array[]) => {
  const length = 12 + chunks.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(length);
  bytes.set(new TextEncoder().encode('RIFF'));
  new DataView(bytes.buffer).setUint32(4, length - 8, true);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  let offset = 12;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};

const webpChunkKinds = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kinds: string[] = [];
  for (let offset = 12; offset < bytes.length; ) {
    const size = view.getUint32(offset + 4, true);
    kinds.push(new TextDecoder().decode(bytes.subarray(offset, offset + 4)));
    offset += 8 + size + (size & 1);
  }
  return kinds;
};

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

  it('does not write an R2 object when D1 rejects the row', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db
      .insert(schema.mediaAssets)
      .values({ id, r2Key: `existing/${id}`, contentType: 'image/webp' });
    const bucket = {
      head: vi.fn((key: string) => env.BUCKET.head(key)),
      put: vi.fn((key: string, value: Uint8Array, options?: R2PutOptions) =>
        env.BUCKET.put(key, value, options)
      ),
      delete: vi.fn((key: string) => env.BUCKET.delete(key)),
    } as unknown as R2Bucket;
    await expect(
      persistMediaUpload(db, bucket, webp(), {
        id,
        altText: '',
        now: new Date('2027-01-01T00:00:00Z'),
      })
    ).rejects.toThrow();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('deletes the D1 row and rethrows the original error when R2 put fails', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    const putError = Error('r2-unavailable');
    const bucket = {
      head: vi.fn((key: string) => env.BUCKET.head(key)),
      put: vi.fn(() => Promise.reject(putError)),
      delete: vi.fn((key: string) => env.BUCKET.delete(key)),
    } as unknown as R2Bucket;
    const error: unknown = await persistMediaUpload(db, bucket, webp(), {
      id,
      altText: 'Secreto',
      now: new Date('2029-03-01T00:00:00Z'),
    }).catch((reason: unknown) => reason);
    expect(error).toBe(putError);
    expect(bucket.delete).not.toHaveBeenCalled();
    expect(await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, id))).toEqual(
      []
    );
  });

  it('logs the asset id and key when D1 compensation fails, preserving the R2 error', async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    const putError = Error('r2-unavailable');
    const bucket = {
      head: vi.fn((key: string) => env.BUCKET.head(key)),
      put: vi.fn(() => Promise.reject(putError)),
      delete: vi.fn((key: string) => env.BUCKET.delete(key)),
    } as unknown as R2Bucket;
    const deleteSpy = vi.spyOn(db, 'delete').mockImplementation(() => {
      throw Error('d1-unavailable');
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      persistMediaUpload(db, bucket, webp(), {
        id,
        altText: 'Secreto',
        now: new Date('2029-03-01T00:00:00Z'),
      })
    ).rejects.toBe(putError);

    expect(deleteSpy).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toContain(id);
    expect(log.mock.calls[0]?.[0]).toContain(`media/2029/03/${id}.webp`);
    expect(JSON.stringify(log.mock.calls)).not.toContain('Secreto');
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

  it('strips EXIF and XMP from direct WebP POSTs before storing and measuring them', async () => {
    const input = webpWithChunks([
      webpChunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
      webpChunk('VP8 ', [0, 0, 0, 0x9d, 1, 0x2a, 2, 0, 1, 0]),
      webpChunk('EXIF', [0x47, 0x50, 0x53]),
      webpChunk('XMP ', [0x58]),
    ]);
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
      body: input,
    });

    const response = await POST({ request, url } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(201);
    const asset = (await response.json()) as { id: string; r2Key: string; sizeBytes: number };
    const stored = new Uint8Array(await (await env.BUCKET.get(asset.r2Key))!.arrayBuffer());
    const strippedLength =
      input.length -
      webpChunk('EXIF', [0x47, 0x50, 0x53]).length -
      webpChunk('XMP ', [0x58]).length;
    expect(webpChunkKinds(stored)).toEqual(['VP8X', 'VP8 ']);
    expect(stored[20]).toBe(0);
    expect(stored.byteLength).toBe(strippedLength);
    expect(asset.sizeBytes).toBe(strippedLength);
    const [row] = await createDb(env.DB)
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, asset.id));
    expect(row?.sizeBytes).toBe(strippedLength);
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
