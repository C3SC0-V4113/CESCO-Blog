import { describe, expect, it } from 'vitest';

import { mediaImageMarkup } from '@/components/admin/media-image-extension';

describe('media image rendering', () => {
  it('never emits an empty source for unavailable assets', () => {
    expect(mediaImageMarkup('missing', 'Texto', () => undefined)).toEqual([
      'span',
      expect.objectContaining({ 'data-media-asset-id': 'missing', role: 'img' }),
      'Imagen no disponible',
    ]);
  });
});
