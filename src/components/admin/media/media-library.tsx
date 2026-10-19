import { useState } from 'react';

import { linkVariants } from '@/components/ui/link-variants';
import { getTranslations } from '@/i18n/utils';

import { MediaCard } from './media-card';
import { MediaUpload } from './media-upload';
import { MetadataForm } from './metadata-form';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');

type Props = {
  assets: AdminMediaAsset[];
  page?: number;
  total?: number;
};

export function MediaLibrary({
  assets: initialAssets,
  page = 1,
  total = initialAssets.length,
}: Props) {
  const [assets, setAssets] = useState(initialAssets);
  const [currentTotal, setCurrentTotal] = useState(total);

  function addAsset(asset: AdminMediaAsset) {
    setAssets((current) => [asset, ...current]);
    setCurrentTotal((current) => current + 1);
  }

  function updateAsset(updated: AdminMediaAsset) {
    setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return (
    <div className="grid gap-6">
      <MediaUpload compact={false} onUploaded={addAsset} />
      {assets.length === 0 ? (
        <p>{t('admin.media.empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={false}>
          {assets.map((asset) => (
            <li key={asset.id} className="min-w-0 overflow-hidden rounded-lg border bg-background">
              <MediaCard asset={asset} />
              <details className="border-t p-3">
                <summary>{t('admin.media.metadata')}</summary>
                <MetadataForm asset={asset} onSaved={updateAsset} />
              </details>
            </li>
          ))}
        </ul>
      )}
      {currentTotal > 20 && (
        <nav aria-label={t('listing.pagination')} className="flex gap-2">
          {page > 1 && (
            <a
              className={linkVariants({ variant: 'admin' })}
              href={`/admin/media?page=${page - 1}`}
            >
              {t('listing.previous')}
            </a>
          )}
          {page * 20 < currentTotal && (
            <a
              className={linkVariants({ variant: 'admin' })}
              href={`/admin/media?page=${page + 1}`}
            >
              {t('listing.next')}
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
