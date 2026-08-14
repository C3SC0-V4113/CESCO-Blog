import { describe, expect, it } from 'vitest';

import {
  imageNode,
  isServableContentType,
  mediaAssetIdFromKey,
  mediaAssetIds,
  mediaKey,
  mediaPath,
  parseWebp,
  readBoundedBody,
} from '@/lib/media';

import { validWebp } from '../fixtures/valid-webp';

/**
 * What the delivery route is allowed to conclude before it touches a bucket.
 *
 * The interesting cases here are the refusals. ADR-0028 rejects SVG at upload;
 * these assert the second refusal, at serving time, which is the one that still
 * holds for an object written before the rule existed.
 */

describe('isServableContentType', () => {
  it.each(['image/webp', 'image/png', 'image/jpeg', 'image/avif', 'image/gif'])(
    'serves %s',
    (type) => {
      expect(isServableContentType(type)).toBe(true);
    }
  );

  it('refuses SVG even though it is an image', () => {
    // The whole reason this list exists rather than a `startsWith('image/')`.
    expect(isServableContentType('image/svg+xml')).toBe(false);
  });

  it.each(['text/html', 'application/javascript', 'application/pdf', 'text/plain'])(
    'refuses %s',
    (type) => {
      expect(isServableContentType(type)).toBe(false);
    }
  );

  it('refuses a missing type rather than guessing one', () => {
    expect(isServableContentType(undefined)).toBe(false);
    expect(isServableContentType(null)).toBe(false);
    expect(isServableContentType('')).toBe(false);
  });

  it('ignores parameters and case', () => {
    // `image/webp; charset=binary` is a legal header and the same decision.
    expect(isServableContentType('image/webp; charset=binary')).toBe(true);
    expect(isServableContentType('IMAGE/PNG')).toBe(true);
  });
});

describe('mediaAssetIdFromKey', () => {
  const id = '9c2f0a51-6d3e-4b52-9c0f-1a7e5d8b3c40';

  it('reads the asset id out of a conventional key', () => {
    expect(mediaAssetIdFromKey(`media/2026/08/${id}.webp`)).toBe(id);
  });

  it.each([
    ['a key with no date prefix', `media/${id}.webp`],
    ['a key outside the media prefix', `other/2026/08/${id}.webp`],
    ['a key with no extension', `media/2026/08/${id}`],
    ['a key whose name is not a uuid', 'media/2026/08/portada.webp'],
    ['a two-digit year', `media/26/08/${id}.webp`],
  ])('returns null for %s', (_label, key) => {
    // Returning null rather than throwing: an unparseable key still serves, it
    // just cannot be tagged for purge. Refusing to serve would make the cache
    // tag a precondition for delivery, which it is not.
    expect(mediaAssetIdFromKey(key)).toBeNull();
  });
});

describe('mediaPath', () => {
  it('addresses an object by its key', () => {
    expect(mediaPath('media/2026/08/9c2f0a51-6d3e-4b52-9c0f-1a7e5d8b3c40.webp')).toBe(
      '/media/2026/08/9c2f0a51-6d3e-4b52-9c0f-1a7e5d8b3c40.webp'
    );
  });
});

describe('media uploads', () => {
  const chunk = (kind: string, payload: number[]) => {
    const bytes = [...Buffer.from(kind), payload.length, 0, 0, 0, ...payload];
    if (payload.length % 2) bytes.push(0);
    return bytes;
  };
  const riff = (...chunks: number[][]) => {
    const body = chunks.flat();
    const bytes = new Uint8Array(12 + body.length);
    bytes.set([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...body]);
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    return bytes;
  };

  it('walks padded chunks and requires real image payload', () => {
    expect(parseWebp(validWebp())).toEqual({ width: 2, height: 1 });
    const source = validWebp();
    const vp8 = Array.from(source.subarray(Buffer.from(source).indexOf('VP8 ')));
    const vp8x = chunk('VP8X', [32, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(parseWebp(riff(vp8x, chunk('ICCP', [1]), vp8))).toEqual({ width: 2, height: 1 });
    const invalidPadding = chunk('ICCP', [1]);
    invalidPadding[invalidPadding.length - 1] = 1;
    expect(() => parseWebp(riff(vp8x, invalidPadding, vp8))).toThrow();
    expect(() => parseWebp(riff(chunk('VP8X', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))).toThrow();
    expect(() => parseWebp(new Uint8Array(Buffer.from('RIFFxxxxWEBPVP8X')))).toThrow();
    const sourceWithTrailing = validWebp();
    const trailing = new Uint8Array(sourceWithTrailing.length + 4);
    trailing.set(sourceWithTrailing);
    trailing.set([1, 2, 3, 4], sourceWithTrailing.length);
    new DataView(trailing.buffer).setUint32(4, trailing.length - 8, true);
    expect(() => parseWebp(trailing)).toThrow();
  });

  it('rejects animation, multiple images, invalid order, and canvas mismatches', () => {
    const source = validWebp();
    const imageChunk = Array.from(source.subarray(Buffer.from(source).indexOf('VP8 ')));
    const vp8x = chunk('VP8X', [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const frame = chunk('ANMF', [...new Array(16).fill(0), ...imageChunk]);
    expect(() => parseWebp(riff(vp8x, frame))).toThrow();
    expect(() => parseWebp(riff(chunk('ANIM', new Array(6).fill(0)), imageChunk))).toThrow();
    expect(() => parseWebp(riff(vp8x, chunk('ANMF', new Array(16).fill(0))))).toThrow();
    expect(() => parseWebp(riff(imageChunk, imageChunk))).toThrow();
    expect(() => parseWebp(riff(imageChunk, vp8x))).toThrow();
    expect(() =>
      parseWebp(riff(chunk('VP8X', [0, 0, 0, 0, 0, 0, 0, 1, 0, 0]), imageChunk))
    ).toThrow();
  });

  it('rejects VP8X reserved bytes and ICCP between alpha and its VP8 payload', () => {
    const source = validWebp();
    const imageChunk = Array.from(source.subarray(Buffer.from(source).indexOf('VP8 ')));
    for (const reservedByte of [1, 2, 3]) {
      const payload = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
      payload[reservedByte] = 1;
      expect(() => parseWebp(riff(chunk('VP8X', payload), imageChunk))).toThrow();
    }
    for (const reservedFlag of [0x80, 0x40, 0x01])
      expect(() =>
        parseWebp(riff(chunk('VP8X', [reservedFlag, 0, 0, 0, 1, 0, 0, 0, 0, 0]), imageChunk))
      ).toThrow();
    const alphaAndProfile = chunk('VP8X', [48, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    expect(() =>
      parseWebp(riff(alphaAndProfile, chunk('ALPH', [0]), chunk('ICCP', [1]), imageChunk))
    ).toThrow();
  });

  it('builds UTC immutable keys and strict image nodes', () => {
    const id = '9c2f0a51-6d3e-4b52-9c0f-1a7e5d8b3c40';
    expect(mediaKey(id, new Date('2026-01-31T23:30:00-06:00'))).toBe(`media/2026/02/${id}.webp`);
    expect(imageNode(id, 'block', 'Texto alternativo')).toEqual({
      type: 'image',
      attrs: { blockId: 'block', mediaAssetId: id, alt: 'Texto alternativo' },
    });
    expect(
      mediaAssetIds({
        type: 'doc',
        content: [imageNode(id, 'block', ''), imageNode(id, 'again', '')],
      })
    ).toEqual([id]);
  });

  it('bounds declared and chunked bodies', async () => {
    await expect(
      readBoundedBody(new Request('https://example.com', { method: 'POST', body: '12345' }), 4)
    ).rejects.toThrow('media-too-large');
    await expect(
      readBoundedBody(
        new Request('https://example.com', {
          method: 'POST',
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(3));
              controller.enqueue(new Uint8Array(3));
              controller.close();
            },
          }),
          duplex: 'half',
        } as RequestInit & { duplex: 'half' }),
        5
      )
    ).rejects.toThrow('media-too-large');
  });
});
