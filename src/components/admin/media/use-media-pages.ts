import { useState } from 'react';

import { callListMedia } from '@/lib/admin-actions';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

type Props = {
  assets: AdminMediaAsset[];
  page: number;
  total: number;
};

export function useMediaPages({ assets: initialAssets, page, total }: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [currentPage, setCurrentPage] = useState(page);
  const [currentTotal, setCurrentTotal] = useState(total);
  // A failed page load is separate from an image processing failure.
  const [pageStatus, setPageStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  async function loadPage(next: number) {
    setPageStatus('loading');
    try {
      const result = await callListMedia({ page: next });
      if (result.error || !result.data) throw Error('page-failed');
      setAssets([...new Map(result.data.assets.map((asset) => [asset.id, asset])).values()]);
      setCurrentTotal(result.data.total);
      setCurrentPage(next);
      setPageStatus('idle');
    } catch {
      setPageStatus('error');
    }
  }

  function addAsset(asset: AdminMediaAsset) {
    setAssets((current) => [asset, ...current]);
    setCurrentTotal((current) => current + 1);
  }

  function updateAsset(updated: AdminMediaAsset) {
    setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return { assets, currentPage, currentTotal, pageStatus, loadPage, addAsset, updateAsset };
}
