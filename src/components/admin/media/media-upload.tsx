import { ImagePlusIcon, LoaderCircleIcon } from 'lucide-react';
import { useId } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getTranslations } from '@/i18n/utils';

import { useMediaUpload } from './use-media-upload';

import type { PendingMediaUploadQueue } from './use-media-upload';
import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');

type Props = {
  compact: boolean;
  onUploaded(asset: AdminMediaAsset): void;
  onSelect?: (asset: AdminMediaAsset) => void;
  pendingUploadQueue?: PendingMediaUploadQueue;
};

export function MediaUpload({ compact, onUploaded, onSelect, pendingUploadQueue }: Props) {
  const uploadState = useMediaUpload({
    onUploaded,
    onSelect,
    pendingUploadQueue,
  });
  const altId = useId();
  const fileId = useId();
  const decorativeId = useId();

  return (
    <section
      aria-label={t('admin.media.upload')}
      className="rounded-lg border border-dashed bg-background p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void uploadState.upload(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files);
        if (files.length) {
          event.preventDefault();
          void uploadState.upload(files);
        }
      }}
    >
      <div
        className={
          compact
            ? 'flex flex-col gap-3 @min-[40rem]:flex-row @min-[40rem]:items-end'
            : 'flex flex-col gap-3 sm:flex-row sm:items-end'
        }
      >
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor={altId}>{t('admin.media.alt')}</FieldLabel>
          <Input
            id={altId}
            ref={uploadState.altInput}
            name="altText"
            className="mt-1"
            disabled={uploadState.decorative}
            value={uploadState.altText}
            onChange={(event) => uploadState.setAltText(event.target.value)}
            aria-invalid={uploadState.altMissing ? true : undefined}
            aria-describedby={uploadState.altMissing ? 'altText-error' : undefined}
          />
        </Field>
        <Field orientation="horizontal" size="control">
          <Checkbox
            id={decorativeId}
            checked={uploadState.decorative}
            onCheckedChange={(checked) => uploadState.setDecorative(checked === true)}
          />
          <FieldLabel htmlFor={decorativeId}>{t('admin.media.decorative')}</FieldLabel>
        </Field>
        <Field className="w-auto">
          <FieldLabel
            htmlFor={fileId}
            className={buttonVariants()}
            data-loading={uploadState.status === 'loading'}
          >
            {uploadState.status === 'loading' ? (
              <LoaderCircleIcon aria-hidden="true" />
            ) : (
              <ImagePlusIcon aria-hidden="true" />
            )}
            {t('admin.media.choose')}
          </FieldLabel>
          <input
            id={fileId}
            data-slot="input"
            className="sr-only"
            ref={uploadState.fileInput}
            type="file"
            aria-label={t('admin.media.choose')}
            disabled={uploadState.status === 'loading'}
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => event.target.files && void uploadState.upload(event.target.files)}
          />
        </Field>
      </div>
      {uploadState.altMissing && (
        <FieldError id="altText-error">{t('admin.media.altRequired')}</FieldError>
      )}
      <p className="mt-2 text-sm text-muted-foreground">{t('admin.media.help')}</p>
      {uploadState.status === 'error' && <p role="alert">{t('admin.media.error')}</p>}
    </section>
  );
}
