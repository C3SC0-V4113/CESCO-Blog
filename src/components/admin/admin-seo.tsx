import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select as BaseSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { callRetryPendingPurges, callSaveSeoDraft } from '@/lib/admin-actions';
import { createDraftSave } from '@/lib/draft-autosave';
import { mediaPath } from '@/lib/media';
import { effectiveSeo } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';

import { FormStatus, PendingButton } from './admin-form';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminAuthor, AdminSeoState } from '@/db/queries/admin-taxonomy';
import type { UiKey } from '@/i18n/ui';
import type { SeoDraftInput } from '@/lib/admin-taxonomy';

const t = getTranslations('es');
type SaveStatus = 'idle' | 'pending' | 'saved' | 'warning' | 'error' | 'conflict';

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
  const [status, setStatus] = useState<SaveStatus>('idle');
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
      form.querySelector<HTMLElement>(`#seo-${field.name}`)?.focus();
    }
  };
  const retryCachePurge = () => {
    setStatus('pending');
    void callRetryPendingPurges().then((result) =>
      setStatus(result.error ? 'error' : result.data.status === 'purged' ? 'saved' : 'warning')
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-seo-preview">
      <form
        className="grid gap-4 rounded-xl border bg-background p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        <SeoFields
          canonical={canonical}
          values={values}
          invalid={invalid}
          authors={authors}
          media={media}
          onChange={set}
        />
        <SeoSaveControls status={status} onRetry={retryCachePurge} />
      </form>
      <SeoPreview effective={effective} image={image} author={author} alt={values.ogImageAlt} />
    </div>
  );
}

function SeoFields({
  canonical,
  values,
  invalid,
  authors,
  media,
  onChange,
}: {
  canonical: string;
  values: FormValues;
  invalid?: Invalid;
  authors: AdminAuthor[];
  media: AdminMediaAsset[];
  onChange(key: keyof FormValues, value: string): void;
}) {
  return (
    <>
      <Field spacing="compact">
        <FieldLabel htmlFor="seo-canonical">{t('admin.seo.canonical')}</FieldLabel>
        <Input id="seo-canonical" name="canonical" readOnly value={canonical} variant="muted" />
      </Field>
      <Text
        name="seoTitle"
        label={t('admin.seo.title')}
        value={values.seoTitle}
        onChange={(value) => onChange('seoTitle', value)}
      />
      <Area
        name="seoDescription"
        label={t('admin.seo.description')}
        value={values.seoDescription}
        onChange={(value) => onChange('seoDescription', value)}
      />
      <Text
        name="ogTitle"
        label={t('admin.seo.ogTitle')}
        value={values.ogTitle}
        onChange={(value) => onChange('ogTitle', value)}
      />
      <Area
        name="ogDescription"
        label={t('admin.seo.ogDescription')}
        value={values.ogDescription}
        onChange={(value) => onChange('ogDescription', value)}
      />
      <ChoiceField
        name="coverMediaId"
        invalid={invalid}
        label={t('admin.seo.cover')}
        value={values.coverMediaId}
        onChange={(value) => onChange('coverMediaId', value)}
        options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
      />
      <ChoiceField
        name="authorId"
        label={t('admin.seo.author')}
        value={values.authorId}
        onChange={(value) => onChange('authorId', value)}
        options={authors.map((item) => ({ value: item.id, label: item.name }))}
      />
      <ChoiceField
        name="ogImageMediaId"
        label={t('admin.seo.ogImage')}
        value={values.ogImageMediaId}
        onChange={(value) => onChange('ogImageMediaId', value)}
        options={media.map((asset) => ({ value: asset.id, label: asset.altText || asset.r2Key }))}
      />
      <Text
        name="ogImageAlt"
        label={t('admin.seo.ogAlt')}
        value={values.ogImageAlt}
        onChange={(value) => onChange('ogImageAlt', value)}
      />
    </>
  );
}

function SeoSaveControls({ status, onRetry }: { status: SaveStatus; onRetry(): void }) {
  return (
    <div className="flex items-center gap-3">
      <PendingButton type="submit" pending={status === 'pending'} disabled={status === 'conflict'}>
        {t('admin.common.save')}
      </PendingButton>
      <FormStatus
        message={
          status === 'saved'
            ? t('admin.common.saved')
            : status === 'warning'
              ? t('admin.common.cacheWarning')
              : undefined
        }
        error={
          status === 'error'
            ? t('admin.common.error')
            : status === 'conflict'
              ? t('admin.editor.status.conflict')
              : undefined
        }
      />
      {status === 'warning' && (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('admin.common.retryCache')}
        </Button>
      )}
    </div>
  );
}

function SeoPreview({
  effective,
  image,
  author,
  alt,
}: {
  effective: ReturnType<typeof effectiveSeo>;
  image?: AdminMediaAsset;
  author?: AdminAuthor;
  alt: string;
}) {
  return (
    <aside>
      <h2 className="mb-3 font-semibold">{t('admin.seo.preview')}</h2>
      <div className="aspect-og-preview overflow-hidden rounded-xl border bg-slate-950 text-white shadow-lg">
        {image && (
          <img
            src={mediaPath(image.r2Key)}
            alt={alt || image.altText || ''}
            className="size-full object-cover opacity-55"
          />
        )}
        <div className="relative mt-[-52.35%] flex aspect-og-preview flex-col justify-end bg-linear-to-t from-black/90 to-transparent p-6">
          <p className="text-sm font-semibold">{author?.name ?? SITE_NAME}</p>
          {/* Styled, not structural: a preview's title is not a section of this page. */}
          <p className="mt-2 text-2xl font-bold">{effective.ogTitle}</p>
          {effective.ogDescription && (
            <p className="mt-2 line-clamp-2 text-sm text-white/80">{effective.ogDescription}</p>
          )}
        </div>
      </div>
    </aside>
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
    <Field spacing="compact">
      <FieldLabel htmlFor={`seo-${name}`}>{label}</FieldLabel>
      <Input
        id={`seo-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
function Area({ name, label, value, onChange }: FieldProps) {
  return (
    <Field spacing="compact">
      <FieldLabel htmlFor={`seo-${name}`}>{label}</FieldLabel>
      <Textarea
        id={`seo-${name}`}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
const NO_SELECTION = '__no-selection__';
function ChoiceField({
  name,
  label,
  value,
  onChange,
  options,
  invalid,
}: FieldProps & { options: Array<{ value: string; label: string }>; invalid?: Invalid }) {
  const message = invalid?.name === name ? invalid.message : undefined;
  return (
    <Field data-invalid={Boolean(message)} spacing="compact">
      <FieldLabel htmlFor={`seo-${name}`}>{label}</FieldLabel>
      <BaseSelect
        value={value || NO_SELECTION}
        onValueChange={(next) => onChange(next === NO_SELECTION ? '' : (next ?? ''))}
        items={[{ value: NO_SELECTION, label: t('admin.common.none') }, ...options]}
      >
        <SelectTrigger
          id={`seo-${name}`}
          className="w-full"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${name}-error` : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={NO_SELECTION}>{t('admin.common.none')}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </BaseSelect>
      {message && <FieldError id={`${name}-error`}>{t(message)}</FieldError>}
    </Field>
  );
}
