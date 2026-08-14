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

export const MEDIA_UPLOAD_LIMIT = 5 * 1024 * 1024;
export const MEDIA_SOURCE_LIMIT = 25 * 1024 * 1024;
export const MEDIA_MAX_WIDTH = 2400;
export const MEDIA_MAX_PIXELS = 40_000_000;

export function mediaKey(id: string, now = new Date()): string {
  return `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.webp`;
}

export function imageNode(mediaAssetId: string, blockId: string, alt: string) {
  return { type: 'image' as const, attrs: { blockId, mediaAssetId, alt } };
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));
const u24 = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
const dimensions = (width: number, height: number) => {
  if (!width || !height || width > MEDIA_MAX_WIDTH || width * height > MEDIA_MAX_PIXELS)
    throw Error('invalid-webp');
  return { width, height };
};
const imageDimensions = (bytes: Uint8Array, kind: string, start: number, size: number) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === 'VP8L' && size >= 5 && bytes[start] === 0x2f) {
    const bits = view.getUint32(start + 1, true);
    return dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (
    kind === 'VP8 ' &&
    size >= 10 &&
    bytes[start + 3] === 0x9d &&
    bytes[start + 4] === 1 &&
    bytes[start + 5] === 0x2a
  )
    return dimensions(
      view.getUint16(start + 6, true) & 0x3fff,
      view.getUint16(start + 8, true) & 0x3fff
    );
  return null;
};

function walkChunks(
  bytes: Uint8Array,
  start: number,
  end: number,
  visit: (kind: string, dataStart: number, size: number) => void
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  while (offset < end) {
    if (end - offset < 8) throw Error('invalid-webp');
    const kind = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const next = dataStart + size + (size & 1);
    if (next > end) throw Error('invalid-webp');
    if ((size & 1) === 1 && bytes[dataStart + size] !== 0) throw Error('invalid-webp');
    visit(kind, dataStart, size);
    offset = next;
  }
  if (offset !== end) throw Error('invalid-webp');
}

/** Structurally validates normalized WebP and reads dimensions without decoding pixels. */
export function parseWebp(bytes: Uint8Array): { width: number; height: number } {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP' ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 !==
      bytes.length
  )
    throw Error('invalid-webp');
  const parsed: {
    canvas: { width: number; height: number } | null;
    still: { width: number; height: number } | null;
  } = { canvas: null, still: null };
  let flags = 0;
  let chunkIndex = 0;
  let alphaPending = false;
  const seen = new Set<string>();
  walkChunks(bytes, 12, bytes.length, (kind, start, size) => {
    if (alphaPending && kind !== 'VP8 ') throw Error('invalid-webp');
    if (kind === 'VP8X') {
      if (
        size !== 10 ||
        parsed.canvas ||
        chunkIndex !== 0 ||
        (bytes[start]! & 0xc3) !== 0 ||
        bytes[start + 1] !== 0 ||
        bytes[start + 2] !== 0 ||
        bytes[start + 3] !== 0
      )
        throw Error('invalid-webp');
      flags = bytes[start]!;
      parsed.canvas = dimensions(u24(bytes, start + 4) + 1, u24(bytes, start + 7) + 1);
    } else if (kind === 'VP8 ' || kind === 'VP8L') {
      if (parsed.still || (seen.has('ALPH') && kind !== 'VP8 ')) throw Error('invalid-webp');
      parsed.still = imageDimensions(bytes, kind, start, size);
      if (!parsed.still) throw Error('invalid-webp');
      alphaPending = false;
    } else if (kind === 'ANIM' || kind === 'ANMF') throw Error('invalid-webp');
    else if (kind === 'ICCP') {
      if (!parsed.canvas || parsed.still || seen.has(kind) || seen.has('ALPH'))
        throw Error('invalid-webp');
      seen.add(kind);
    } else if (kind === 'ALPH') {
      if (!parsed.canvas || parsed.still || seen.has(kind)) throw Error('invalid-webp');
      seen.add(kind);
      alphaPending = true;
    } else if (kind === 'EXIF' || kind === 'XMP ') {
      if (
        !parsed.canvas ||
        !parsed.still ||
        seen.has(kind) ||
        (kind === 'EXIF' && seen.has('XMP '))
      )
        throw Error('invalid-webp');
      seen.add(kind);
    } else throw Error('invalid-webp');
    chunkIndex++;
  });
  if (!parsed.still) throw Error('invalid-webp');
  if (parsed.canvas) {
    if (parsed.canvas.width !== parsed.still.width || parsed.canvas.height !== parsed.still.height)
      throw Error('invalid-webp');
    const expectedFlags =
      (seen.has('ICCP') ? 32 : 0) |
      (seen.has('ALPH') ? 16 : 0) |
      (seen.has('EXIF') ? 8 : 0) |
      (seen.has('XMP ') ? 4 : 0);
    if ((flags & 0x3e) !== expectedFlags) throw Error('invalid-webp');
  } else if (chunkIndex !== 1) throw Error('invalid-webp');
  return parsed.canvas ?? parsed.still;
}

export function mediaAssetIds(content: unknown): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const node = value as { type?: unknown; attrs?: unknown; content?: unknown };
    if (node.type === 'image' && node.attrs && typeof node.attrs === 'object') {
      const id = (node.attrs as { mediaAssetId?: unknown }).mediaAssetId;
      if (typeof id === 'string') ids.add(id);
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(content);
  return [...ids];
}

export async function readBoundedBody(request: Request, limit = MEDIA_UPLOAD_LIMIT) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limit) {
    await request.body?.cancel();
    throw Error('media-too-large');
  }
  if (!request.body) throw Error('missing-media');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw Error('media-too-large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
