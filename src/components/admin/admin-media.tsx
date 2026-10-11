import { ImagePlusIcon, LoaderCircleIcon } from 'lucide-react';
import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getTranslations } from '@/i18n/utils';
import { callUpdateMediaAsset } from '@/lib/admin-actions';
import { normalizeImage } from '@/lib/image-normalize';
import { mediaPath } from '@/lib/media';

import type { AdminMediaAsset } from '@/db/queries/admin-media';

const t = getTranslations('es');
const metadataFields = [
  'caption',
  'description',
  'creatorName',
  'sourceUrl',
  'licenseLabel',
  'licenseUrl',
] as const;
/** Lets the editor hand over files pasted or dropped outside the upload box. */
export type MediaUploader = { upload(files: File[]): void };
type Props = {
  assets: AdminMediaAsset[];
  page?: number;
  total?: number;
  onSelect?(asset: AdminMediaAsset): void;
  ref?: Ref<MediaUploader>;
};

export function AdminMedia({
  assets: initial,
  page = 1,
  total = initial.length,
  onSelect,
  ref,
}: Props) {
  const [assets, setAssets] = useState(initial);
  const [currentPage, setCurrentPage] = useState(page);
  const [currentTotal, setCurrentTotal] = useState(total);
  const [altText, setAltText] = useState('');
  const [decorative, setDecorative] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const decorativeCheckboxId = useId();

  async function loadPage(next: number) {
    setStatus('loading');
    try {
      const response = await fetch(`/admin/media/page.json?page=${next}`);
      if (!response.ok) throw Error('page-failed');
      const result = (await response.json()) as { assets: AdminMediaAsset[]; total: number };
      setAssets([...new Map(result.assets.map((asset) => [asset.id, asset])).values()]);
      setCurrentTotal(result.total);
      setCurrentPage(next);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  async function upload(files: FileList | File[]) {
    if (files.length !== 1 || (!decorative && !altText.trim())) {
      setStatus('error');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setStatus('loading');
    try {
      const { blob } = await normalizeImage(files[0]!);
      const response = await fetch('/admin/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/webp',
          'X-Cesco-Media-Upload': '1',
          'X-Cesco-Media-Metadata': encodeURIComponent(JSON.stringify({ decorative, altText })),
        },
        body: blob,
      });
      if (!response.ok) throw Error('upload-failed');
      const asset = (await response.json()) as AdminMediaAsset;
      setAssets((current) => [asset, ...current]);
      setCurrentTotal((current) => current + 1);
      setStatus('idle');
      onSelect?.(asset);
    } catch {
      setStatus('error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  // Rebuilt on every render so a handed-over file meets the alt text and the
  // decorative choice as they are now, exactly like one chosen here.
  useImperativeHandle(ref, () => ({ upload: (files) => void upload(files) }));

  return (
    <div className="grid gap-6">
      <section
        aria-label={t('admin.media.upload')}
        className="rounded-xl border border-dashed bg-background p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files);
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (files.length) {
            event.preventDefault();
            void upload(files);
          }
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="media-upload-alt">{t('admin.media.alt')}</FieldLabel>
            <Input
              id="media-upload-alt"
              className="mt-1 h-10 px-3"
              disabled={decorative}
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
            />
          </Field>
          <Field orientation="horizontal" className="h-10 w-auto items-center gap-2">
            <Checkbox
              id={decorativeCheckboxId}
              checked={decorative}
              onCheckedChange={(checked) => setDecorative(checked === true)}
            />
            <FieldLabel htmlFor={decorativeCheckboxId}>{t('admin.media.decorative')}</FieldLabel>
          </Field>
          <Field className="w-auto">
            <FieldLabel
              htmlFor="media-upload-file"
              className={buttonVariants({ className: status === 'loading' ? 'opacity-50' : '' })}
              aria-disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <ImagePlusIcon />
              )}
              {t('admin.media.choose')}
            </FieldLabel>
            <Input
              id="media-upload-file"
              className="sr-only"
              ref={fileInput}
              type="file"
              disabled={status === 'loading'}
              accept="image/png,image/jpeg,image/webp"
              aria-label={t('admin.media.choose')}
              onChange={(event) => event.target.files && void upload(event.target.files)}
            />
          </Field>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('admin.media.help')}</p>
        {status === 'error' && <p role="alert">{t('admin.media.error')}</p>}
      </section>
      {assets.length === 0 ? (
        <p>{t('admin.media.empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <li key={asset.id} className="overflow-hidden rounded-xl border bg-background">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full flex-col items-stretch justify-start rounded-none p-0 text-left font-normal whitespace-normal hover:bg-transparent"
                onClick={() => onSelect?.(asset)}
              >
                <img
                  src={mediaPath(asset.r2Key)}
                  alt={asset.altText ?? ''}
                  className="aspect-video w-full object-cover"
                />
                <span className="block truncate p-3">
                  {asset.altText || t('admin.media.decorative')}
                </span>
              </Button>
              <details className="border-t p-3">
                <summary>{t('admin.media.metadata')}</summary>
                <MetadataForm
                  asset={asset}
                  onSaved={(updated) =>
                    setAssets((current) =>
                      current.map((item) => (item.id === updated.id ? updated : item))
                    )
                  }
                />
              </details>
            </li>
          ))}
        </ul>
      )}
      {currentTotal > 20 && (
        <nav aria-label={t('listing.pagination')} className="flex gap-2">
          {currentPage > 1 &&
            (onSelect ? (
              <Button type="button" variant="link" onClick={() => void loadPage(currentPage - 1)}>
                {t('listing.previous')}
              </Button>
            ) : (
              <a href={`/admin/media?page=${currentPage - 1}`}>{t('listing.previous')}</a>
            ))}
          {currentPage * 20 < currentTotal &&
            (onSelect ? (
              <Button type="button" variant="link" onClick={() => void loadPage(currentPage + 1)}>
                {t('listing.next')}
              </Button>
            ) : (
              <a href={`/admin/media?page=${currentPage + 1}`}>{t('listing.next')}</a>
            ))}
        </nav>
      )}
    </div>
  );
}

function MetadataForm({
  asset,
  onSaved,
}: {
  asset: AdminMediaAsset;
  onSaved(asset: AdminMediaAsset): void;
}) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const decorativeCheckboxId = useId();
  const isOwnWorkCheckboxId = useId();
  const save = async (form: HTMLFormElement) => {
    setStatus('pending');
    const data = new FormData(form);
    try {
      const result = await callUpdateMediaAsset({
        id: asset.id,
        decorative: data.get('decorative') === 'on',
        altText: String(data.get('altText') ?? ''),
        isOwnWork: data.get('isOwnWork') === 'on',
        ...Object.fromEntries(
          metadataFields.map((field) => [field, String(data.get(field) ?? '') || null])
        ),
      });
      if (result.error) throw result.error;
      onSaved(result.data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };
  return (
    <form className="mt-3 grid gap-2">
      <Input
        name="altText"
        aria-label={t('admin.media.alt')}
        defaultValue={asset.altText ?? ''}
        className="h-10 px-3"
      />
      <Field orientation="horizontal" className="items-center">
        <Checkbox
          id={decorativeCheckboxId}
          name="decorative"
          defaultChecked={asset.altText === ''}
        />
        <FieldLabel htmlFor={decorativeCheckboxId}>{t('admin.media.decorative')}</FieldLabel>
      </Field>
      {metadataFields.map((field) => (
        <Input
          key={field}
          name={field}
          aria-label={t(`admin.media.${field}`)}
          defaultValue={asset[field] ?? ''}
          className="h-10 px-3"
        />
      ))}
      <Field orientation="horizontal" className="items-center">
        <Checkbox id={isOwnWorkCheckboxId} name="isOwnWork" defaultChecked={asset.isOwnWork} />
        <FieldLabel htmlFor={isOwnWorkCheckboxId}>{t('admin.media.isOwnWork')}</FieldLabel>
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={status === 'pending'}
        onClick={(event) => void save(event.currentTarget.form!)}
      >
        {t('admin.media.saveMetadata')}
      </Button>
      <p role={status === 'error' ? 'alert' : 'status'}>
        {status === 'pending'
          ? t('admin.media.metadataPending')
          : status === 'success'
            ? t('admin.media.metadataSuccess')
            : status === 'error'
              ? t('admin.media.metadataError')
              : ''}
      </p>
    </form>
  );
}
