import {
  MEDIA_MAX_PIXELS,
  MEDIA_MAX_WIDTH,
  MEDIA_SOURCE_LIMIT,
  MEDIA_UPLOAD_LIMIT,
} from '@/lib/media';

type Decoded = { width: number; height: number; source: CanvasImageSource; close(): void };
export type ImagePlatform = {
  decode(file: File): Promise<Decoded>;
  encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob>;
};

const browserPlatform: ImagePlatform = {
  async decode(file) {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  },
  async encode(source, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(source, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error('image-encode-failed'))),
        'image/webp',
        quality
      )
    );
  },
};

const signature = (bytes: Uint8Array, expected: number[]) =>
  bytes.length >= expected.length && expected.every((value, index) => bytes[index] === value);
const jpegSizeMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const safeDimensions = (width: number, height: number) => {
  if (!width || !height || width * height > MEDIA_MAX_PIXELS)
    throw Error('invalid-image-dimensions');
  return { width, height };
};

export function inspectImageHeader(bytes: Uint8Array, type: string, totalSize: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png') {
    if (
      bytes.length < 24 ||
      !signature(bytes, [137, 80, 78, 71, 13, 10, 26, 10]) ||
      String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'
    )
      throw Error('invalid-image-source');
    return safeDimensions(view.getUint32(16), view.getUint32(20));
  }
  if (type === 'image/jpeg') {
    if (!signature(bytes, [0xff, 0xd8])) throw Error('invalid-image-source');
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 0xff) throw Error('invalid-image-source');
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++]!;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw Error('invalid-image-source');
      if (jpegSizeMarkers.has(marker))
        return safeDimensions(view.getUint16(offset + 3), view.getUint16(offset + 5));
      offset += length;
    }
    throw Error('invalid-image-source');
  }
  if (type === 'image/webp') {
    if (
      bytes.length < 30 ||
      String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP' ||
      view.getUint32(4, true) + 8 !== totalSize
    )
      throw Error('invalid-image-source');
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === 'VP8X')
      return safeDimensions(
        (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1,
        (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1
      );
    if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a)
      return safeDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
    if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return safeDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
  }
  throw Error('invalid-image-source');
}

export async function normalizeImage(file: File, platform = browserPlatform) {
  if (
    file.size > MEDIA_SOURCE_LIMIT ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  )
    throw Error('invalid-image-source');
  const header =
    file.type === 'image/jpeg'
      ? new Uint8Array(await file.arrayBuffer())
      : new Uint8Array(await file.slice(0, 65_536).arrayBuffer());
  inspectImageHeader(header, file.type, file.size);
  const decoded = await platform.decode(file);
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > MEDIA_MAX_PIXELS)
      throw Error('invalid-image-dimensions');
    const width = Math.min(decoded.width, MEDIA_MAX_WIDTH);
    const height = Math.max(1, Math.round((decoded.height * width) / decoded.width));
    const blob = await platform.encode(decoded.source, width, height, 0.82);
    if (blob.type !== 'image/webp' || blob.size > MEDIA_UPLOAD_LIMIT)
      throw Error('invalid-image-output');
    return { blob, width, height };
  } finally {
    decoded.close();
  }
}
