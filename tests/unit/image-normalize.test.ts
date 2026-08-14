import { describe, expect, it, vi } from 'vitest';

import { inspectImageHeader, normalizeImage } from '@/lib/image-normalize';

import { validWebp } from '../fixtures/valid-webp';

const png = (width = 800, height = 600) => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], 'image.png', { type: 'image/png' });
};
const file = (size = 10, type = 'image/png') =>
  new File([new Uint8Array(size)], 'image.png', { type });

describe('normalizeImage', () => {
  it('does not upscale and encodes WebP at the approved quality', async () => {
    const encode = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array(100)], { type: 'image/webp' }));
    const output = await normalizeImage(png(), {
      decode: vi.fn().mockResolvedValue({ width: 800, height: 600, source: {}, close: vi.fn() }),
      encode,
    });
    expect(encode).toHaveBeenCalledWith({}, 800, 600, 0.82);
    expect(output).toMatchObject({ width: 800, height: 600 });
  });

  it('caps width and rejects unsafe sources and oversized output', async () => {
    const decode = vi
      .fn()
      .mockResolvedValue({ width: 4800, height: 2400, source: {}, close: vi.fn() });
    const encode = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array(100)], { type: 'image/webp' }));
    expect((await normalizeImage(png(4800, 2400), { decode, encode })).width).toBe(2400);
    await expect(normalizeImage(file(10, 'image/svg+xml'), { decode, encode })).rejects.toThrow();
    await expect(
      normalizeImage(png(4800, 2400), {
        decode,
        encode: vi.fn().mockResolvedValue(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])),
      })
    ).rejects.toThrow();
  });

  it('rejects oversized or malformed headers before decode', async () => {
    const decode = vi.fn();
    await expect(normalizeImage(png(50_000, 1_000), { decode, encode: vi.fn() })).rejects.toThrow(
      'invalid-image-dimensions'
    );
    await expect(normalizeImage(file(), { decode, encode: vi.fn() })).rejects.toThrow(
      'invalid-image-source'
    );
    expect(decode).not.toHaveBeenCalled();
  });

  it('bounds JPEG and WebP dimensions from headers', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x03, 0xe8, 0xc3, 0x50, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11,
      0,
    ]);
    expect(() => inspectImageHeader(jpeg, 'image/jpeg', jpeg.length)).toThrow(
      'invalid-image-dimensions'
    );
    const webp = validWebp();
    expect(inspectImageHeader(webp.subarray(0, 64), 'image/webp', webp.length)).toEqual({
      width: 2,
      height: 1,
    });
    expect(() => inspectImageHeader(new Uint8Array(30), 'image/webp', 30)).toThrow(
      'invalid-image-source'
    );
  });

  it('finds a valid JPEG SOF beyond 64 KiB before decoding', async () => {
    const app = new Uint8Array(65_537);
    app.set([0xff, 0xe1, 0xff, 0xff]);
    const sof = new Uint8Array([
      0xff, 0xc0, 0, 17, 8, 0, 200, 1, 64, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0,
    ]);
    const jpeg = new File([new Uint8Array([0xff, 0xd8]), app, sof], 'deep.jpg', {
      type: 'image/jpeg',
    });
    const decode = vi.fn().mockResolvedValue({
      width: 320,
      height: 200,
      source: {},
      close: vi.fn(),
    });
    await expect(
      normalizeImage(jpeg, {
        decode,
        encode: vi.fn().mockResolvedValue(new Blob(['ok'], { type: 'image/webp' })),
      })
    ).resolves.toMatchObject({ width: 320, height: 200 });
    expect(decode).toHaveBeenCalledOnce();
    await expect(
      normalizeImage(
        new File([new Uint8Array([0xff, 0xd8]), app], 'truncated.jpg', { type: 'image/jpeg' }),
        {
          decode,
          encode: vi.fn(),
        }
      )
    ).rejects.toThrow('invalid-image-source');
  });
});
