import { z } from 'zod';

import { persistMediaUpload } from '@/actions/media';
import { MEDIA_UPLOAD_LIMIT, readBoundedBody } from '@/lib/media';
import { drainBody } from '@/lib/request-body';
import { getBucket, getDb } from '@/lib/runtime';

import type { APIRoute } from 'astro';

const uploadMetadata = z
  .strictObject({ decorative: z.boolean(), altText: z.string().max(1000) })
  .refine(({ decorative, altText }) => decorative || altText.trim().length > 0);

export const POST: APIRoute = async ({ request, url }) => {
  if (
    request.headers.get('origin') !== url.origin ||
    request.headers.get('x-cesco-media-upload') !== '1'
  ) {
    await drainRejected(request);
    return response(403, 'UPLOAD_FORBIDDEN');
  }
  if (request.headers.get('content-type') !== 'image/webp') {
    await drainRejected(request);
    return response(415, 'INVALID_MEDIA');
  }
  let metadata: z.infer<typeof uploadMetadata>;
  try {
    metadata = uploadMetadata.parse(
      JSON.parse(decodeURIComponent(request.headers.get('x-cesco-media-metadata') ?? ''))
    );
  } catch (error) {
    await drainRejected(request);
    console.error(
      `Media upload metadata rejected: ${error instanceof Error ? error.stack : String(error)}`
    );
    return response(400, 'INVALID_MEDIA');
  }
  try {
    const bytes = await readBoundedBody(request, MEDIA_UPLOAD_LIMIT);
    const asset = await persistMediaUpload(getDb(), getBucket(), bytes, {
      altText: metadata.decorative ? '' : metadata.altText.trim(),
    });
    return Response.json(asset, { status: 201 });
  } catch (error) {
    console.error(`Media upload failed: ${error instanceof Error ? error.stack : String(error)}`);
    const message = error instanceof Error ? error.message : '';
    const status =
      message === 'media-too-large'
        ? 413
        : error instanceof z.ZodError || ['invalid-webp', 'media-collision'].includes(message)
          ? 400
          : 500;
    return response(status, status === 500 ? 'UPLOAD_FAILED' : 'INVALID_MEDIA');
  }
};

const response = (status: number, error: string) => Response.json({ error }, { status });
const drainRejected = (request: Request) =>
  drainBody(request.body, Number(request.headers.get('content-length') ?? Number.NaN));
