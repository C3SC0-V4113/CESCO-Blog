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
