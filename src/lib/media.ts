/**
 * Serving rules for stored media (ADR-0028, ADR-0033).
 *
 * Pure, so the parts that decide what may be served are checked without a
 * bucket or a network (ADR-0031). The endpoint does the I/O; everything it is
 * allowed to conclude lives here.
 */

/**
 * Types the site will hand back, regardless of what is stored.
 *
 * ADR-0028 rejects SVG at upload because, served from our own origin, it is an
 * XSS vector. This list repeats that rejection at the other end of the pipe: an
 * allow-list at upload protects against what arrives, and an allow-list here
 * protects against whatever is already in the bucket — a key written before the
 * rule existed, or by a path that bypassed it. One of the two checks is
 * redundant only until it isn't.
 */
const SERVABLE_CONTENT_TYPES = new Set([
  'image/webp',
  'image/png',
  'image/jpeg',
  'image/avif',
  'image/gif',
]);

export function isServableContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false;

  // Parameters are legal on a media type and irrelevant to the decision.
  const [base] = contentType.split(';');

  return SERVABLE_CONTENT_TYPES.has(base!.trim().toLowerCase());
}

/**
 * A year of caching, and `immutable` on top of it.
 *
 * Safe because of the key convention rather than by optimism: ADR-0028 derives
 * `media/{yyyy}/{mm}/{mediaAssetId}.{ext}` once at creation and never rewrites
 * it, so a key names one byte sequence for as long as it exists. Replacing an
 * image means a new asset and a new key, which is a new URL.
 */
export const MEDIA_MAX_AGE = 31_536_000;

/**
 * Short, because a miss is usually a race rather than a fact: a card referenced
 * by a revision published seconds before its object finished uploading. Caching
 * that for a year would outlive the upload by the length of the cache.
 */
export const MEDIA_MISS_MAX_AGE = 60;

/**
 * The asset id a key belongs to, or `null` if the key does not follow the
 * convention.
 *
 * Read from the key rather than looked up, which is what keeps the delivery
 * path free of database queries. The id is only used to tag the response for
 * purging (ADR-0011); nothing is served on the strength of it, so a key that
 * does not parse still serves — it just cannot be purged by asset.
 */
export function mediaAssetIdFromKey(key: string): string | null {
  const match = /^media\/\d{4}\/\d{2}\/([0-9a-f-]{36})\.[a-z0-9]+$/i.exec(key);

  return match ? match[1]!.toLowerCase() : null;
}

/** Public path for a stored object. The key is the address; there is no lookup. */
export function mediaPath(r2Key: string): string {
  return `/${r2Key}`;
}
