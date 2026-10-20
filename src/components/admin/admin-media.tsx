import { ImagePlusIcon, LoaderCircleIcon } from 'lucide-react';
import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getTranslations } from '@/i18n/utils';
import { callListMedia, callUpdateMediaAsset } from '@/lib/admin-actions';
import { normalizeImage } from '@/lib/image-normalize';
import { mediaPath } from '@/lib/media';

import { FormStatus, PendingButton } from './admin-form';

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
const urlFields: ReadonlySet<string> = new Set(['sourceUrl', 'licenseUrl']);
/** Lets the editor hand over files pasted or dropped outside the upload box. */
export type MediaUploader = { upload(files: File[]): void };
type Props = {
  assets: AdminMediaAsset[];
  page?: number;
  total?: number;
  onSelect?(asset: AdminMediaAsset): void;
  showLibraryLink?: boolean;
  ref?: Ref<MediaUploader>;
};

export function AdminMedia({
  assets: initial,
  page = 1,
  total = initial.length,
  onSelect,
  showLibraryLink = true,
  ref,
}: Props) {
  const [assets, setAssets] = useState(initial);
  const [currentPage, setCurrentPage] = useState(page);
  const [currentTotal, setCurrentTotal] = useState(total);
  // Kept apart from the upload: a page that fails to load is not an image that
  // failed to process, and loading one does not block an upload.
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

  const handleUploaded = (asset: AdminMediaAsset) => {
    setAssets((current) => [asset, ...current]);
    setCurrentTotal((current) => current + 1);
  };

  return (
    <div className={onSelect ? '@container grid gap-6' : 'grid gap-6'}>
      <MediaUpload
        ref={ref}
        onUploaded={handleUploaded}
        onSelect={onSelect}
        compact={Boolean(onSelect)}
      />
      <MediaAssetList
        assets={assets}
        pageStatus={pageStatus}
        onSelect={onSelect}
        onSaved={(updated) =>
          setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)))
        }
      />
      {onSelect && showLibraryLink && (
        <a className={buttonVariants({ variant: 'link', size: 'xs' })} href="/admin/media">
          {t('admin.media.openLibrary')}
        </a>
      )}
      <MediaPagination
        page={currentPage}
        total={currentTotal}
        picker={Boolean(onSelect)}
        loadPage={loadPage}
      />
      {pageStatus === 'error' && <p role="alert">{t('admin.media.pageError')}</p>}
    </div>
  );
}

function MediaUpload({
  onUploaded,
  onSelect,
  compact,
  ref,
}: {
  onUploaded(asset: AdminMediaAsset): void;
  onSelect?: (asset: AdminMediaAsset) => void;
  compact: boolean;
  ref?: Ref<MediaUploader>;
}) {
  const [altText, setAltText] = useState('');
  const [decorative, setDecorative] = useState(false);
  const [altMissing, setAltMissing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const fileInput = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);
  const altId = useId();
  const fileId = useId();
  const decorativeId = useId();

  async function upload(files: FileList | File[]) {
    if (files.length === 1 && !decorative && !altText.trim()) {
      setAltMissing(true);
      setStatus('idle');
      // Let the sheet's initial focus settle before moving to the required field.
      requestAnimationFrame(() => altInput.current?.focus());
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    if (files.length !== 1) {
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
      onUploaded(asset);
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
    <section
      aria-label={t('admin.media.upload')}
      className="rounded-lg border border-dashed bg-background p-4"
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
            ref={altInput}
            name="altText"
            className="mt-1"
            disabled={decorative}
            value={altText}
            onChange={(event) => {
              setAltText(event.target.value);
              setAltMissing(false);
            }}
            aria-invalid={altMissing ? true : undefined}
            aria-describedby={altMissing ? 'altText-error' : undefined}
          />
        </Field>
        <Field orientation="horizontal" size="control">
          <Checkbox
            id={decorativeId}
            checked={decorative}
            onCheckedChange={(checked) => {
              setDecorative(checked === true);
              setAltMissing(false);
            }}
          />
          <FieldLabel htmlFor={decorativeId}>{t('admin.media.decorative')}</FieldLabel>
        </Field>
        <Field className="w-auto">
          <FieldLabel
            htmlFor={fileId}
            className={buttonVariants()}
            data-loading={status === 'loading'}
          >
            {status === 'loading' ? (
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
            ref={fileInput}
            type="file"
            aria-label={t('admin.media.choose')}
            disabled={status === 'loading'}
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => event.target.files && void upload(event.target.files)}
          />
        </Field>
      </div>
      {altMissing && <FieldError id="altText-error">{t('admin.media.altRequired')}</FieldError>}
      <p className="mt-2 text-sm text-muted-foreground">{t('admin.media.help')}</p>
      {status === 'error' && <p role="alert">{t('admin.media.error')}</p>}
    </section>
  );
}

function MediaAssetList({
  assets,
  pageStatus,
  onSelect,
  onSaved,
}: {
  assets: AdminMediaAsset[];
  pageStatus: 'idle' | 'loading' | 'error';
  onSelect?: (asset: AdminMediaAsset) => void;
  onSaved(asset: AdminMediaAsset): void;
}) {
  if (assets.length === 0) return <p>{t('admin.media.empty')}</p>;
  return (
    <ul
      className={
        onSelect
          ? 'grid grid-cols-1 gap-3 @min-[40rem]:grid-cols-2 @min-[64rem]:grid-cols-3'
          : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
      }
      aria-busy={pageStatus === 'loading'}
    >
      {assets.map((asset) => (
        <li key={asset.id} className="min-w-0 overflow-hidden rounded-lg border bg-background">
          {onSelect ? (
            <button
              type="button"
              className="flex w-full items-center justify-start gap-3 rounded-none border border-transparent bg-transparent p-2 text-left text-sm font-normal whitespace-normal transition-colors outline-none hover:bg-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset active:scale-press motion-reduce:transition-none"
              onClick={() => onSelect(asset)}
            >
              <MediaCard asset={asset} compact />
            </button>
          ) : (
            <MediaCard asset={asset} />
          )}
          {!onSelect && (
            <details className="border-t p-3">
              <summary>{t('admin.media.metadata')}</summary>
              <MetadataForm asset={asset} onSaved={onSaved} />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function MediaPagination({
  page,
  total,
  picker,
  loadPage,
}: {
  page: number;
  total: number;
  picker: boolean;
  loadPage(page: number): Promise<void>;
}) {
  if (total <= 20) return null;
  return (
    <nav aria-label={t('listing.pagination')} className="flex gap-2">
      {page > 1 &&
        (picker ? (
          <Button type="button" variant="link" onClick={() => void loadPage(page - 1)}>
            {t('listing.previous')}
          </Button>
        ) : (
          <a
            className={buttonVariants({ variant: 'link', size: 'xs' })}
            href={`/admin/media?page=${page - 1}`}
          >
            {t('listing.previous')}
          </a>
        ))}
      {page * 20 < total &&
        (picker ? (
          <Button type="button" variant="link" onClick={() => void loadPage(page + 1)}>
            {t('listing.next')}
          </Button>
        ) : (
          <a
            className={buttonVariants({ variant: 'link', size: 'xs' })}
            href={`/admin/media?page=${page + 1}`}
          >
            {t('listing.next')}
          </a>
        ))}
    </nav>
  );
}

/**
 * The caption already says what the alt text says, so the image is left
 * unnamed rather than read twice.
 */
function MediaCard({ asset, compact = false }: { asset: AdminMediaAsset; compact?: boolean }) {
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

function MetadataForm({
  asset,
  onSaved,
}: {
  asset: AdminMediaAsset;
  onSaved(asset: AdminMediaAsset): void;
}) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const formId = useId();
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
    <form
      className="mt-3 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <Field spacing="compact">
        <FieldLabel htmlFor={`${formId}-alt`}>{t('admin.media.alt')}</FieldLabel>
        <Input id={`${formId}-alt`} name="altText" defaultValue={asset.altText ?? ''} />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          id={`${formId}-decorative`}
          name="decorative"
          defaultChecked={asset.altText === ''}
        />
        <FieldLabel htmlFor={`${formId}-decorative`}>{t('admin.media.decorative')}</FieldLabel>
      </Field>
      {metadataFields.map((field) => (
        <Field key={field} spacing="compact">
          <FieldLabel htmlFor={`${formId}-${field}`}>{t(`admin.media.${field}`)}</FieldLabel>
          <Input
            id={`${formId}-${field}`}
            name={field}
            defaultValue={asset[field] ?? ''}
            {...(urlFields.has(field) && { type: 'url', inputMode: 'url' as const })}
          />
        </Field>
      ))}
      <Field orientation="horizontal">
        <Checkbox id={`${formId}-own-work`} name="isOwnWork" defaultChecked={asset.isOwnWork} />
        <FieldLabel htmlFor={`${formId}-own-work`}>{t('admin.media.isOwnWork')}</FieldLabel>
      </Field>
      <PendingButton type="submit" variant="outline" pending={status === 'pending'}>
        {t('admin.media.saveMetadata')}
      </PendingButton>
      <FormStatus
        message={
          status === 'pending'
            ? t('admin.media.metadataPending')
            : status === 'success'
              ? t('admin.media.metadataSuccess')
              : undefined
        }
        error={status === 'error' ? t('admin.media.metadataError') : undefined}
      />
    </form>
  );
}
