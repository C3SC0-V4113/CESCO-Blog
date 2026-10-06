import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callCreateAuthor, callRetryPendingPurges, callUpdateAuthor } from '@/lib/admin-actions';
import { cn } from '@/lib/utils';

import { inputClass, PendingButton, selectClass, textareaClass } from './admin-form';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminAuthor } from '@/db/queries/admin-taxonomy';

const t = getTranslations('es');

export function AdminAuthors({
  authors,
  media,
}: {
  authors: AdminAuthor[];
  media: AdminMediaAsset[];
}) {
  return (
    <div className="grid gap-5">
      <AuthorForm media={media} />
      {authors.map((author) => (
        <AuthorForm key={author.id} author={author} media={media} />
      ))}
    </div>
  );
}

function AuthorForm({ author, media }: { author?: AdminAuthor; media: AdminMediaAsset[] }) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'warning' | 'error'>(
    'idle'
  );
  const sameAsHelpId = useId();
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setStatus('pending');
    const input = {
      id: author?.id ?? crypto.randomUUID(),
      slug: String(data.get('slug') ?? ''),
      name: String(data.get('name') ?? ''),
      bio: String(data.get('bio') ?? '') || null,
      avatarMediaId: String(data.get('avatarMediaId') ?? '') || null,
      websiteUrl: String(data.get('websiteUrl') ?? '') || null,
      sameAs: String(data.get('sameAs') ?? '')
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    };
    if (author) {
      const result = await callUpdateAuthor(input);
      setStatus(
        result.error
          ? 'error'
          : result.data.status === 'saved-with-cache-warning'
            ? 'warning'
            : 'success'
      );
      return;
    }

    const result = await callCreateAuthor(input);
    if (result.error) setStatus('error');
    else window.location.reload();
  };
  const sameAs = Array.isArray(author?.sameAs)
    ? author.sameAs.filter((value): value is string => typeof value === 'string')
    : [];
  return (
    <form
      className="grid gap-4 rounded-xl border bg-background p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <h2 className="text-lg font-semibold">{author ? author.name : t('admin.authors.new')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t('admin.authors.name')}
          name="name"
          defaultValue={author?.name}
          autoComplete="off"
          required
        />
        <Field
          label={t('admin.authors.slug')}
          name="slug"
          defaultValue={author?.slug}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <Field
          label={t('admin.authors.website')}
          name="websiteUrl"
          type="url"
          inputMode="url"
          defaultValue={author?.websiteUrl ?? ''}
        />
        <label>
          {t('admin.authors.avatar')}
          <select
            name="avatarMediaId"
            defaultValue={author?.avatarMediaId ?? ''}
            className={cn('mt-1', selectClass)}
          >
            <option value="">{t('admin.common.none')}</option>
            {media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.altText || asset.r2Key}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t('admin.authors.bio')}
        <textarea
          name="bio"
          defaultValue={author?.bio ?? ''}
          className={cn('mt-1', textareaClass)}
        />
      </label>
      <div>
        <label>
          {t('admin.authors.sameAs')}
          <textarea
            name="sameAs"
            defaultValue={sameAs.join('\n')}
            aria-describedby={sameAsHelpId}
            spellCheck={false}
            className={cn('mt-1 min-h-20', textareaClass)}
          />
        </label>
        <p id={sameAsHelpId} className="mt-1 text-sm text-muted-foreground">
          {t('admin.authors.sameAsHelp')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <PendingButton type="submit" pending={status === 'pending'}>
          {t('admin.common.save')}
        </PendingButton>
        <p role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error'
            ? t('admin.common.error')
            : status === 'success'
              ? t('admin.common.saved')
              : status === 'warning'
                ? t('admin.common.cacheWarning')
                : ''}
        </p>
        {status === 'warning' && author && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStatus('pending');
              void callRetryPendingPurges().then((result) =>
                setStatus(
                  result.error ? 'error' : result.data.status === 'purged' ? 'success' : 'warning'
                )
              );
            }}
          >
            {t('admin.common.retryCache')}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label>
      {label}
      <input name={name} className={cn('mt-1', inputClass)} {...props} />
    </label>
  );
}
