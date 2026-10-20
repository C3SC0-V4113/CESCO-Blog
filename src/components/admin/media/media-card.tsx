import { getTranslations } from '@/i18n/utils';
import { mediaPath } from '@/lib/media';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');

/** The caption already says what the alt text says, so the image is left unnamed rather than read twice. */
export function MediaCard({
  asset,
  compact = false,
}: {
  asset: AdminMediaAsset;
  compact?: boolean;
}) {
  return (
    <>
      <img
        src={mediaPath(asset.r2Key)}
        alt=""
        className={
          compact ? 'size-16 shrink-0 rounded-md object-cover' : 'aspect-video w-full object-cover'
        }
      />
      <span className={compact ? 'min-w-0 flex-1 p-2 wrap-break-word' : 'block truncate p-3'}>
        {asset.altText || t('admin.media.decorative')}
      </span>
    </>
  );
}
