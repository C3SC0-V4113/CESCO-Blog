/**
 * Dimensions from the three WebP bitstream headers (ADR-0036).
 *
 * The browser checks a WebP source before decoding it and the Worker checks the
 * normalized upload, and both must agree on where each header keeps its size.
 * Pure and dependency-free, so the client bundle takes it without pulling in
 * anything the Worker uses.
 *
 * Bounds stay with the caller: the browser rejects a source the canvas cannot
 * hold, the Worker rejects anything normalization would not have produced.
 */

const u24 = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

/** Remove location and other private metadata from a directly uploaded WebP. */
export function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (
    bytes.length < 12 ||
    ascii(0, 4) !== 'RIFF' ||
    ascii(8, 4) !== 'WEBP' ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw Error('invalid-webp');

  const chunks: { start: number; end: number; kind: string; flags?: number }[] = [];
  let changed = false;
  for (let offset = 12; offset < bytes.length;) {
    if (bytes.length - offset < 8) throw Error('invalid-webp');
    const kind = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const end = dataStart + size + (size & 1);
    if (end > bytes.length) throw Error('invalid-webp');
    if (kind === 'EXIF' || kind === 'XMP ') changed = true;
    let flags: number | undefined;
    if (kind === 'VP8X') {
      if (size < 1) throw Error('invalid-webp');
      flags = bytes[dataStart]! & ~0x0c;
      if (flags !== bytes[dataStart]) changed = true;
    }
    chunks.push({ start: offset, end, kind, flags });
    offset = end;
  }
  if (!changed) return bytes;

  const kept = chunks.filter(({ kind }) => kind !== 'EXIF' && kind !== 'XMP ');
  const length = 12 + kept.reduce((total, { start, end }) => total + end - start, 0);
  const output = new Uint8Array(length);
  output.set(bytes.subarray(0, 12));
  new DataView(output.buffer).setUint32(4, length - 8, true);
  let outputOffset = 12;
  for (const { start, end, kind, flags } of kept) {
    output.set(bytes.subarray(start, end), outputOffset);
    if (kind === 'VP8X' && flags !== undefined) output[outputOffset + 8] = flags;
    outputOffset += end - start;
  }
  return output;
}

/**
 * `start` is the first payload byte of a `kind` chunk and `size` its length.
 * Null when the payload is too short or lacks the bitstream's signature.
 */
export function readWebpDimensions(
  bytes: Uint8Array,
  kind: string,
  start: number,
  size: number
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === 'VP8X' && size >= 10)
    return { width: u24(bytes, start + 4) + 1, height: u24(bytes, start + 7) + 1 };
  if (kind === 'VP8L' && size >= 5 && bytes[start] === 0x2f) {
    const bits = view.getUint32(start + 1, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (
    kind === 'VP8 ' &&
    size >= 10 &&
    bytes[start + 3] === 0x9d &&
    bytes[start + 4] === 1 &&
    bytes[start + 5] === 0x2a
  )
    // The top two bits of each field are upscaling hints, not size.
    return {
      width: view.getUint16(start + 6, true) & 0x3fff,
      height: view.getUint16(start + 8, true) & 0x3fff,
    };
  return null;
}
