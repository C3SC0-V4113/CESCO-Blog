import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({ callListMedia: vi.fn() }));
vi.mock('@/lib/image-normalize', () => ({
  normalizeImage: vi.fn().mockResolvedValue({ blob: new Blob(['webp'], { type: 'image/webp' }) }),
}));

import { useMediaPages } from '@/components/admin/media/use-media-pages';
import { PendingMediaUploadQueue, useMediaUpload } from '@/components/admin/media/use-media-upload';
import { callListMedia } from '@/lib/admin-actions';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const asset = {
  id: 'asset-1',
  r2Key: 'media/2026/08/mapa.webp',
  altText: 'Mapa',
  caption: null,
  description: null,
  isOwnWork: false,
  creatorName: null,
  sourceUrl: null,
  licenseLabel: null,
  licenseUrl: null,
  contentType: 'image/webp',
  width: 10,
  height: 10,
  sizeBytes: 4,
  createdAt: '2026-08-13',
  updatedAt: '2026-08-13',
} satisfies AdminMediaAsset;

describe('media hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('loads a picker page and removes duplicate asset IDs', async () => {
    vi.mocked(callListMedia).mockResolvedValue({
      data: { assets: [asset, asset], total: 21 },
      error: undefined,
    } as never);
    const { result } = renderHook(() => useMediaPages({ assets: [], page: 1, total: 21 }));

    await act(async () => result.current.loadPage(2));

    expect(callListMedia).toHaveBeenCalledWith({ page: 2 });
    expect(result.current.assets).toEqual([asset]);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.currentTotal).toBe(21);
    expect(result.current.pageStatus).toBe('idle');
  });

  it('requires alt text unless decorative and consumes files queued before mount', async () => {
    const pendingUploadQueue = new PendingMediaUploadQueue();
    pendingUploadQueue.enqueue([new File(['png'], 'mapa.png', { type: 'image/png' })]);
    const onUploaded = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onUploaded, pendingUploadQueue }));

    await waitFor(() => expect(result.current.altMissing).toBe(true));
    expect(fetch).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('uploads a decorative image and selects the returned asset', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(asset), { status: 201 }));
    const onUploaded = vi.fn();
    const onSelect = vi.fn();
    const { result } = renderHook(() => useMediaUpload({ onUploaded, onSelect }));
    act(() => result.current.setDecorative(true));

    await act(async () => {
      await result.current.upload([new File(['png'], 'mapa.png', { type: 'image/png' })]);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/admin/media/upload',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Cesco-Media-Metadata': encodeURIComponent(
            JSON.stringify({ decorative: true, altText: '' })
          ),
        }),
      })
    );
    expect(onUploaded).toHaveBeenCalledWith(asset);
    expect(onSelect).toHaveBeenCalledWith(asset);
    expect(result.current.status).toBe('idle');
  });
});
