import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { schema, type Db } from '@/db/client';
import { newMediaAssetId } from '@/lib/ids';
import { mediaKey, parseWebp } from '@/lib/media';

export const mediaMetadataSchema = z
  .strictObject({
    id: z.uuid(),
    decorative: z.boolean(),
    altText: z.string().max(1000),
    caption: z.string().max(2000).nullish(),
    description: z.string().max(5000).nullish(),
    isOwnWork: z.boolean().optional(),
    creatorName: z.string().max(500).nullish(),
    sourceUrl: z.url().nullish(),
    licenseLabel: z.string().max(500).nullish(),
    licenseUrl: z.url().nullish(),
  })
  .refine(({ decorative, altText }) => decorative || altText.trim().length > 0, {
    path: ['altText'],
  });

export async function persistMediaUpload(
  db: Db,
  bucket: R2Bucket,
  bytes: Uint8Array,
  input: { id?: string; altText: string; now?: Date }
) {
  const id = input.id ?? newMediaAssetId();
  const r2Key = mediaKey(id, input.now);
  const { width, height } = parseWebp(bytes);
  if (await bucket.head(r2Key)) throw Error('media-collision');
  // A D1 row without its object is visible but misses briefly; an R2 object
  // without its row is invisible, billable, and can survive a Worker crash.
  const [asset] = await db
    .insert(schema.mediaAssets)
    .values({
      id,
      r2Key,
      altText: input.altText,
      contentType: 'image/webp',
      width,
      height,
      sizeBytes: bytes.byteLength,
    })
    .returning();
  try {
    await bucket.put(r2Key, bytes, {
      httpMetadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    // A failed row cleanup is logged and never replaces the R2 error.
    try {
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
    } catch {
      console.error(`Media upload left a row without an R2 object: ${id} ${r2Key}`);
    }
    throw error;
  }
  return asset!;
}

export async function updateMediaAsset(db: Db, raw: z.input<typeof mediaMetadataSchema>) {
  const input = mediaMetadataSchema.parse(raw);
  const [updated] = await db
    .update(schema.mediaAssets)
    .set({
      altText: input.decorative ? '' : input.altText.trim(),
      caption: input.caption || null,
      description: input.description || null,
      isOwnWork: input.isOwnWork ?? false,
      creatorName: input.creatorName || null,
      sourceUrl: input.sourceUrl || null,
      licenseLabel: input.licenseLabel || null,
      licenseUrl: input.licenseUrl || null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(schema.mediaAssets.id, input.id))
    .returning();
  if (!updated) throw Error('media-not-found');
  return updated;
}
