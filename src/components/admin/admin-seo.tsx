import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callRetryPendingPurges, callSaveSeoDraft } from '@/lib/admin-actions';
import { createDraftSave } from '@/lib/draft-autosave';
import { mediaPath } from '@/lib/media';
import { effectiveSeo } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminAuthor, AdminSeoState } from '@/db/queries/admin-taxonomy';
import type { UiKey } from '@/i18n/ui';
import type { SeoDraftInput } from '@/lib/admin-taxonomy';

const t = getTranslations('es');

type SeoValues = Omit<SeoDraftInput, 'draftToken' | 'nextToken'>;
type FormValues = Record<
  | 'seoTitle'
  | 'seoDescription'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogImageMediaId'
  | 'ogImageAlt'
  | 'coverMediaId'
  | 'authorId',
  string
>;

const saveErrorCopy: Partial<Record<string, UiKey>> = {
  'cover-required-while-published': 'admin.seo.coverRequired',
};

export function AdminSeo({
  seo,
  authors,
  media,
  canonical,
}: {
  seo: AdminSeoState;
  authors: AdminAuthor[];
  media: AdminMediaAsset[];
  canonical: string;
}) {
  const [values, setValues] = useState<FormValues>({
    seoTitle: seo.seoTitle ?? '',
    seoDescription: seo.seoDescription ?? '',
    ogTitle: seo.ogTitle ?? '',
    ogDescription: seo.ogDescription ?? '',
    ogImageMediaId: seo.ogImageMediaId ?? '',
    ogImageAlt: seo.ogImageAlt ?? '',
    coverMediaId: seo.coverMediaId ?? '',
    authorId: seo.authorId ?? '',
  });
  const [status, setStatus] = useState<
    'idle' | 'pending' | 'saved' | 'warning' | 'error' | 'conflict'
  >('idle');
  const [error, setError] = useState<UiKey>('admin.common.error');
  const outcome = useRef<'saved' | 'warning'>('saved');
  // The same values object for an unedited retry, so the queue below replays
  // the lost attempt rather than sending it again under a fresh token.
  const submitted = useRef<{ from: FormValues; value: SeoValues } | undefined>(undefined);
  // Created once: it owns the attempt tokens, which must outlive every render
  // and which the editor's autosave shares through the draft row (ADR-0035).
  const [send] = useState(() =>
    createDraftSave<SeoValues>(seo.draftToken, async (value, tokens) => {
      const result = await callSaveSeoDraft({ ...value, ...tokens });
      if (result.error) throw result.error;
      outcome.current = result.data.status === 'saved-with-cache-warning' ? 'warning' : 'saved';
    })
  );
  const effective = effectiveSeo({
    title: seo.title,
    excerpt: seo.excerpt,
    seoTitle: values.seoTitle || null,
    seoDescription: values.seoDescription || null,
    ogTitle: values.ogTitle || null,
    ogDescription: values.ogDescription || null,
  });
  const image = media.find(({ id }) => id === (values.ogImageMediaId || values.coverMediaId));
  const author = authors.find(({ id }) => id === values.authorId);
  const set = (key: keyof FormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (submitted.current?.from !== values)
      submitted.current = {
        from: values,
        value: {
          postId: seo.postId,
          localizationId: seo.localizationId,
          seoTitle: values.seoTitle,
          seoDescription: values.seoDescription,
          ogTitle: values.ogTitle,
          ogDescription: values.ogDescription,
          ogImageMediaId: values.ogImageMediaId || null,
          ogImageAlt: values.ogImageAlt,
          coverMediaId: values.coverMediaId || null,
          authorId: values.authorId || null,
        },
      };
    setStatus('pending');
    try {
      await send(submitted.current.value);
      setStatus(outcome.current);
    } catch (caught) {
      const { code, message } = (caught ?? {}) as { code?: string; message?: string };
      // Another session moved the draft on; saving over it would lose its work.
      if (code === 'CONFLICT') return setStatus('conflict');
      setError(saveErrorCopy[message ?? ''] ?? 'admin.common.error');
      setStatus('error');
    }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
      <form className="grid gap-4 rounded-xl border bg-background p-5">
        <label>
          {t('admin.seo.canonical')}
          <input
            readOnly
            value={canonical}
            className="mt-1 h-10 w-full rounded-lg border bg-muted px-3"
          />
        </label>
        <Text
          label={t('admin.seo.title')}
          value={values.seoTitle}
          onChange={(value) => set('seoTitle', value)}
        />
        <Area
          label={t('admin.seo.description')}
          value={values.seoDescription}
          onChange={(value) => set('seoDescription', value)}
        />
        <Text
          label={t('admin.seo.ogTitle')}
          value={values.ogTitle}
          onChange={(value) => set('ogTitle', value)}
        />
        <Area
          label={t('admin.seo.ogDescription')}
          value={values.ogDescription}
          onChange={(value) => set('ogDescription', value)}
        />
        <Select
          label={t('admin.seo.cover')}
          value={values.coverMediaId}
          onChange={(value) => set('coverMediaId', value)}
          options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
        />
        <Select
          label={t('admin.seo.author')}
          value={values.authorId}
          onChange={(value) => set('authorId', value)}
          options={authors.map((item) => ({ value: item.id, label: item.name }))}
        />
        <Select
          label={t('admin.seo.ogImage')}
          value={values.ogImageMediaId}
          onChange={(value) => set('ogImageMediaId', value)}
          options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
        />
        <Text
          label={t('admin.seo.ogAlt')}
          value={values.ogImageAlt}
          onChange={(value) => set('ogImageAlt', value)}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={status === 'pending' || status === 'conflict'}
            onClick={() => void save()}
          >
            {t('admin.common.save')}
          </Button>
          <p role={status === 'error' || status === 'conflict' ? 'alert' : 'status'}>
            {status === 'error'
              ? t(error)
              : status === 'conflict'
                ? t('admin.editor.status.conflict')
                : status === 'saved'
                  ? t('admin.common.saved')
                  : status === 'warning'
                    ? t('admin.common.cacheWarning')
                    : ''}
          </p>
          {status === 'warning' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStatus('pending');
                void callRetryPendingPurges().then((result) =>
                  setStatus(
                    result.error ? 'error' : result.data.status === 'purged' ? 'saved' : 'warning'
                  )
                );
              }}
            >
              {t('admin.common.retryCache')}
            </Button>
          )}
        </div>
      </form>
      <aside>
        <h2 className="mb-3 font-semibold">{t('admin.seo.preview')}</h2>
        <div className="aspect-[1.91/1] overflow-hidden rounded-xl border bg-slate-950 text-white shadow-lg">
          {image && (
            <img
              src={mediaPath(image.r2Key)}
              alt={values.ogImageAlt || image.altText || ''}
              className="h-full w-full object-cover opacity-55"
            />
          )}
          <div className="relative -mt-[52.35%] flex aspect-[1.91/1] flex-col justify-end bg-gradient-to-t from-black/90 to-transparent p-6">
            <p className="text-sm font-semibold">{author?.name ?? SITE_NAME}</p>
            <h3 className="mt-2 text-2xl font-bold">{effective.ogTitle}</h3>
            {effective.ogDescription && (
              <p className="mt-2 line-clamp-2 text-sm text-white/80">{effective.ogDescription}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
      />
    </label>
  );
}
function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
      >
        <option value="">{t('admin.common.none')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
