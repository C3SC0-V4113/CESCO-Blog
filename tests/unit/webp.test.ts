import { describe, expect, it } from 'vitest';

import { readWebpDimensions, stripWebpMetadata } from '@/lib/webp';

import { validWebp } from '../fixtures/valid-webp';

// A chunk payload placed after a few unrelated bytes, so a reader that ignores
// the view's byte offset reads the wrong header.
const payload = (bytes: number[]) => {
  const buffer = new Uint8Array(bytes.length + 3);
  buffer.set(bytes, 3);
  return buffer.subarray(3);
};

const chunk = (kind: string, data: number[]) => {
  const bytes = new Uint8Array(8 + data.length + (data.length & 1));
  bytes.set(new TextEncoder().encode(kind), 0);
  new DataView(bytes.buffer).setUint32(4, data.length, true);
  bytes.set(data, 8);
  return bytes;
};

const webp = (chunks: Uint8Array[]) => {
  const length = 12 + chunks.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, length - 8, true);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  let offset = 12;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};

const chunksOf = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: { kind: string; data: Uint8Array; bytes: Uint8Array }[] = [];
  for (let offset = 12; offset < bytes.length; ) {
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size & 1);
    chunks.push({
      kind: new TextDecoder().decode(bytes.subarray(offset, offset + 4)),
      data: bytes.subarray(offset + 8, offset + 8 + size),
      bytes: bytes.subarray(offset, end),
    });
    offset = end;
  }
  return chunks;
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

describe('stripWebpMetadata', () => {
  it('removes EXIF and XMP, clears their flags, and preserves other padded chunks', () => {
    const input = webp([
      chunk('VP8X', [0x3c, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
      chunk('ICCP', [1, 2, 3]),
      chunk('EXIF', [0x47, 0x50, 0x53]),
      chunk('ALPH', [0x11]),
      chunk('XMP ', [0x58, 0x4d]),
      chunk('VP8 ', [0, 0, 0, 0x9d, 1, 0x2a, 2, 0, 1, 0]),
    ]);

    const stripped = stripWebpMetadata(input);
    const chunks = chunksOf(stripped);

    expect(chunks.map(({ kind }) => kind)).toEqual(['VP8X', 'ICCP', 'ALPH', 'VP8 ']);
    expect(chunks[0]!.data[0]).toBe(0x30);
    expect(chunks[1]!.bytes).toEqual(chunk('ICCP', [1, 2, 3]));
    expect(chunks[2]!.bytes).toEqual(chunk('ALPH', [0x11]));
    expect(chunks[3]!.bytes).toEqual(chunk('VP8 ', [0, 0, 0, 0x9d, 1, 0x2a, 2, 0, 1, 0]));
    expect(new DataView(stripped.buffer).getUint32(4, true)).toBe(stripped.length - 8);
    expect(chunksOf(input).some(({ kind }) => kind === 'EXIF')).toBe(true);
    expect(readWebpDimensions(stripped, 'VP8X', 20, 10)).toEqual({ width: 2, height: 1 });
  });

  it('leaves a WebP without EXIF or XMP byte-for-byte unchanged', () => {
    const input = validWebp();
    expect(stripWebpMetadata(input)).toBe(input);
  });

  it('preserves unrelated animation and VP8L chunks unchanged', () => {
    const input = webp([
      chunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 0, 0, 0]),
      chunk('ANIM', [7, 8, 9]),
      chunk('EXIF', [10]),
      chunk('VP8L', [0x2f, 1, 0, 0, 0]),
    ]);

    const chunks = chunksOf(stripWebpMetadata(input));

    expect(chunks.map(({ kind }) => kind)).toEqual(['VP8X', 'ANIM', 'VP8L']);
    expect(chunks[1]!.bytes).toEqual(chunk('ANIM', [7, 8, 9]));
    expect(chunks[2]!.bytes).toEqual(chunk('VP8L', [0x2f, 1, 0, 0, 0]));
  });
});
