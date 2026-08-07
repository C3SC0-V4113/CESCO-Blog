import { cacheTagHeader } from '@/lib/cache-tags';
import {
  MEDIA_MAX_AGE,
  MEDIA_MISS_MAX_AGE,
  isServableContentType,
  mediaAssetIdFromKey,
} from '@/lib/media';
import { getBucket } from '@/lib/runtime';

import type { APIRoute } from 'astro';

/**
 * Public delivery for stored media (ADR-0033).
 *
 * Addressed by R2 key rather than by `media_assets.id`, and that is the whole
 * reason this path costs nothing: the key is the address, so serving an image
 * spends no D1 query. ADR-0028 already made the key safe to expose — it is
 * derived once from an identifier that is not a secret, and never rewritten.
 *
 * Two refusals matter more than the happy path:
 *
 * **Content type is checked against an allow-list**, not passed through. ADR-0028
 * rejects SVG at upload for XSS; this repeats it at serving time, which is the
 * check that still holds for anything already in the bucket. `nosniff` closes
 * the other half — without it a browser may decide for itself what a file is.
 *
 * **A miss is a `404`, briefly cached.** A card referenced by a revision
 * published seconds before its upload finished is a race, not a fact, and a
 * long-lived cached miss would outlive the upload.
 */

/** Handles both verbs: a `HEAD` is a `GET` whose body is dropped by the runtime. */
export const GET: APIRoute = async (context) => {
  const suffix = context.params.key;

  if (!suffix) return notFound();

  // The route lives under `/media/`, so the stored key is that prefix plus what
  // the catch-all matched. Rebuilt rather than taken from the URL, which would
  // let `..` segments through.
  const key = `media/${suffix}`;

  if (suffix.includes('..')) return notFound();

  const object = await getBucket().get(key);

  if (!object) return notFound();

  const contentType = object.httpMetadata?.contentType;

  if (!isServableContentType(contentType)) {
    // Deliberately a 404 and not a 415: whether an object exists at a key is not
    // something an unauthenticated caller needs to learn, and "there is a file
    // here I refuse to give you" is exactly that.
    return notFound();
  }

  // `If-None-Match` handled here rather than left to the platform, because the
  // saving is a whole object read on every repeat request.
  const etag = object.httpEtag;

  if (context.request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders(key, etag) });
  }

  return new Response(object.body, {
    headers: {
      ...cacheHeaders(key, etag),
      'Content-Type': contentType!,
      'Content-Length': String(object.size),
    },
  });
};

function cacheHeaders(key: string, etag: string): Record<string, string> {
  const assetId = mediaAssetIdFromKey(key);

  return {
    ETag: etag,
    'Cache-Control': `public, max-age=${MEDIA_MAX_AGE}, immutable`,
    'X-Content-Type-Options': 'nosniff',
    // Tagged so deleting an asset can purge it (ADR-0011). A key that does not
    // follow the convention still serves; it just carries no tag, because a
    // wrong tag is worse than none.
    ...(assetId ? { 'Cache-Tag': cacheTagHeader([`media-${assetId}`]) } : {}),
  };
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': `public, max-age=${MEDIA_MISS_MAX_AGE}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
