import { Button } from '@/components/ui/button';
import { linkVariants } from '@/components/ui/link-variants';
import { getTranslations } from '@/i18n/utils';

import { MediaCard } from './media-card';
import { MediaUpload } from './media-upload';
import { useMediaPages } from './use-media-pages';

import type { PendingMediaUploadQueue } from './use-media-upload';
import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');

type Props = {
  assets: AdminMediaAsset[];
  page?: number;
  total?: number;
  onSelect(asset: AdminMediaAsset): void;
  showLibraryLink?: boolean;
  pendingUploadQueue?: PendingMediaUploadQueue;
};

export function MediaPicker({
  assets: initialAssets,
  page = 1,
  total = initialAssets.length,
  onSelect,
  showLibraryLink = true,
  pendingUploadQueue,
}: Props) {
  const pages = useMediaPages({ assets: initialAssets, page, total });

  return (
    <div className="@container grid gap-6">
      <MediaUpload
        compact
        onUploaded={pages.addAsset}
        onSelect={onSelect}
        pendingUploadQueue={pendingUploadQueue}
      />
      {pages.assets.length === 0 ? (
        <p>{t('admin.media.empty')}</p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[64rem]:grid-cols-3"
          aria-busy={pages.pageStatus === 'loading'}
        >
          {pages.assets.map((asset) => (
            <li key={asset.id} className="min-w-0 overflow-hidden rounded-lg border bg-background">
              <button
                type="button"
                className="flex w-full items-center justify-start gap-3 rounded-none border border-transparent bg-transparent p-2 text-left text-sm font-normal whitespace-normal transition-colors outline-none hover:bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset active:scale-press motion-reduce:transition-none"
                onClick={() => onSelect(asset)}
              >
                <MediaCard asset={asset} compact />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showLibraryLink && (
        <a className={linkVariants({ variant: 'admin' })} href="/admin/media">
          {t('admin.media.openLibrary')}
        </a>
      )}
      {pages.currentTotal > 20 && (
        <nav aria-label={t('listing.pagination')} className="flex gap-2">
          {pages.currentPage > 1 && (
            <Button
              type="button"
              variant="link"
              onClick={() => void pages.loadPage(pages.currentPage - 1)}
            >
              {t('listing.previous')}
            </Button>
          )}
          {pages.currentPage * 20 < pages.currentTotal && (
            <Button
              type="button"
              variant="link"
              onClick={() => void pages.loadPage(pages.currentPage + 1)}
            >
              {t('listing.next')}
            </Button>
          )}
        </nav>
      )}
      {pages.pageStatus === 'error' && <p role="alert">{t('admin.media.pageError')}</p>}
    </div>
  );
}
