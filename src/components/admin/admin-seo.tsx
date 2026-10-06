import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callRetryPendingPurges, callSaveSeoDraft } from '@/lib/admin-actions';
import { createDraftSave } from '@/lib/draft-autosave';
import { mediaPath } from '@/lib/media';
import { effectiveSeo } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

import {
  FieldError,
  inputClass,
  invalidField,
  PendingButton,
  selectClass,
  textareaClass,
} from './admin-form';

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

type Invalid = { name: keyof FormValues; message: UiKey };

// Rejections that belong to one field, so the message sits beside it.
const fieldErrors: Partial<Record<string, Invalid>> = {
  'cover-required-while-published': { name: 'coverMediaId', message: 'admin.seo.coverRequired' },
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
  const [invalid, setInvalid] = useState<Invalid>();
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
  const save = async (form: HTMLFormElement) => {
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
    setInvalid(undefined);
    try {
      await send(submitted.current.value);
      setStatus(outcome.current);
    } catch (caught) {
      const { code, message } = (caught ?? {}) as { code?: string; message?: string };
      // Another session moved the draft on; saving over it would lose its work.
      if (code === 'CONFLICT') return setStatus('conflict');
      const field = fieldErrors[message ?? ''];
      if (!field) return setStatus('error');
      // Rendered before the move, so focus lands on a field already described.
      flushSync(() => {
        setInvalid(field);
        setStatus('idle');
      });
      (form.elements.namedItem(field.name) as HTMLElement | null)?.focus();
    }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
      <form
        className="grid gap-4 rounded-xl border bg-background p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        <label>
          {t('admin.seo.canonical')}
          <input
            name="canonical"
            readOnly
            value={canonical}
            className={cn('mt-1 bg-muted', inputClass)}
          />
        </label>
        <Text
          name="seoTitle"
          label={t('admin.seo.title')}
          value={values.seoTitle}
          onChange={(value) => set('seoTitle', value)}
        />
        <Area
          name="seoDescription"
          label={t('admin.seo.description')}
          value={values.seoDescription}
          onChange={(value) => set('seoDescription', value)}
        />
        <Text
          name="ogTitle"
          label={t('admin.seo.ogTitle')}
          value={values.ogTitle}
          onChange={(value) => set('ogTitle', value)}
        />
        <Area
          name="ogDescription"
          label={t('admin.seo.ogDescription')}
          value={values.ogDescription}
          onChange={(value) => set('ogDescription', value)}
        />
        <Select
          name="coverMediaId"
          invalid={invalid}
          label={t('admin.seo.cover')}
          value={values.coverMediaId}
          onChange={(value) => set('coverMediaId', value)}
          options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
        />
        <Select
          name="authorId"
          label={t('admin.seo.author')}
          value={values.authorId}
          onChange={(value) => set('authorId', value)}
          options={authors.map((item) => ({ value: item.id, label: item.name }))}
        />
        <Select
          name="ogImageMediaId"
          label={t('admin.seo.ogImage')}
          value={values.ogImageMediaId}
          onChange={(value) => set('ogImageMediaId', value)}
          options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
        />
        <Text
          name="ogImageAlt"
          label={t('admin.seo.ogAlt')}
          value={values.ogImageAlt}
          onChange={(value) => set('ogImageAlt', value)}
        />
        <div className="flex items-center gap-3">
          <PendingButton
            type="submit"
            pending={status === 'pending'}
            disabled={status === 'conflict'}
          >
            {t('admin.common.save')}
          </PendingButton>
          <p role={status === 'error' || status === 'conflict' ? 'alert' : 'status'}>
            {status === 'error'
              ? t('admin.common.error')
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
            {/* Styled, not structural: a preview's title is not a section of this page. */}
            <p className="mt-2 text-2xl font-bold">{effective.ogTitle}</p>
            {effective.ogDescription && (
              <p className="mt-2 line-clamp-2 text-sm text-white/80">{effective.ogDescription}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
type FieldProps = {
  name: keyof FormValues;
  label: string;
  value: string;
  onChange(value: string): void;
};
function Text({ name, label, value, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('mt-1', inputClass)}
      />
    </label>
  );
}
function Area({ name, label, value, onChange }: FieldProps) {
  return (
    <label>
      {label}
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('mt-1', textareaClass)}
      />
    </label>
  );
}
function Select({
  name,
  label,
  value,
  onChange,
  options,
  invalid,
}: FieldProps & { options: Array<{ value: string; label: string }>; invalid?: Invalid }) {
  const message = invalid?.name === name ? invalid.message : undefined;
  return (
    <div>
      <label>
        {label}
        <select
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn('mt-1', selectClass)}
          {...invalidField(name, Boolean(message))}
        >
          <option value="">{t('admin.common.none')}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {message && <FieldError name={name}>{t(message)}</FieldError>}
    </div>
  );
}
