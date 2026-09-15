import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callCreateAuthor, callRetryPendingPurges, callUpdateAuthor } from '@/lib/admin-actions';

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
    <form className="grid gap-4 rounded-xl border bg-background p-5">
      <h2 className="text-lg font-semibold">{author ? author.name : t('admin.authors.new')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('admin.authors.name')} name="name" defaultValue={author?.name} required />
        <Field label={t('admin.authors.slug')} name="slug" defaultValue={author?.slug} required />
        <Field
          label={t('admin.authors.website')}
          name="websiteUrl"
          type="url"
          defaultValue={author?.websiteUrl ?? ''}
        />
        <label>
          {t('admin.authors.avatar')}
          <select
            name="avatarMediaId"
            defaultValue={author?.avatarMediaId ?? ''}
            className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
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
          className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"
        />
      </label>
      <label>
        {t('admin.authors.sameAs')}
        <textarea
          name="sameAs"
          defaultValue={sameAs.join('\n')}
          className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={status === 'pending'}
          onClick={(event) => void save(event.currentTarget.form!)}
        >
          {t('admin.common.save')}
        </Button>
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
      <input
        name={name}
        className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
        {...props}
      />
    </label>
  );
}
