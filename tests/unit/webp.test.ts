import { describe, expect, it } from 'vitest';

import { readWebpDimensions } from '@/lib/webp';

import { validWebp } from '../fixtures/valid-webp';

// A chunk payload placed after a few unrelated bytes, so a reader that ignores
// the view's byte offset reads the wrong header.
const payload = (bytes: number[]) => {
  const buffer = new Uint8Array(bytes.length + 3);
  buffer.set(bytes, 3);
  return buffer.subarray(3);
};

describe('readWebpDimensions', () => {
  it('reads a lossy VP8 frame header and drops its scaling bits', () => {
    const webp = validWebp();
    const start = Buffer.from(webp).indexOf('VP8 ') + 8;
    expect(readWebpDimensions(webp, 'VP8 ', start, webp.length - start)).toEqual({
      width: 2,
      height: 1,
    });
    const scaled = payload([0, 0, 0, 0x9d, 1, 0x2a, 0x2c, 0xc1, 0xc8, 0x40]);
    expect(readWebpDimensions(scaled, 'VP8 ', 0, 10)).toEqual({ width: 300, height: 200 });
  });

  it('reads a lossless VP8L header after its signature', () => {
    // Width and height are stored minus one in 14-bit fields: 3 by 5.
    const lossless = payload([0x2f, 0x02, 0x00, 0x01, 0x00]);
    expect(readWebpDimensions(lossless, 'VP8L', 0, 5)).toEqual({ width: 3, height: 5 });
  });

  it('reads the VP8X canvas from its 24-bit fields', () => {
    const extended = payload([0, 0, 0, 0, 0x2b, 0x01, 0x00, 0xc7, 0x00, 0x00]);
    expect(readWebpDimensions(extended, 'VP8X', 0, 10)).toEqual({ width: 300, height: 200 });
  });

  it('returns null for a header it cannot vouch for and leaves bounds to the caller', () => {
    const lossy = payload([0, 0, 0, 0x9d, 1, 0x2a, 0, 0, 0, 0]);
    expect(readWebpDimensions(lossy, 'VP8 ', 0, 10)).toEqual({ width: 0, height: 0 });
    expect(readWebpDimensions(lossy, 'VP8 ', 0, 9)).toBeNull();
    expect(readWebpDimensions(payload([0, 0, 0, 0x9d, 1, 0x2b, 0, 0, 0, 0]), 'VP8 ', 0, 10)).toBe(
      null
    );
    expect(readWebpDimensions(payload([0x2e, 0, 0, 0, 0]), 'VP8L', 0, 5)).toBeNull();
    expect(readWebpDimensions(payload([0x2f, 0, 0, 0, 0]), 'VP8L', 0, 4)).toBeNull();
    expect(readWebpDimensions(payload(new Array(10).fill(0)), 'VP8X', 0, 9)).toBeNull();
    expect(readWebpDimensions(payload(new Array(10).fill(0)), 'ALPH', 0, 10)).toBeNull();
  });
});
