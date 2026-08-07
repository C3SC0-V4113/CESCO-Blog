import { describe, expect, it } from 'vitest';

import { isServableContentType, mediaAssetIdFromKey, mediaPath } from '@/lib/media';

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
