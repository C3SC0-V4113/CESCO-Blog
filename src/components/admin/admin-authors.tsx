import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { callCreateAuthor, callRetryPendingPurges, callUpdateAuthor } from '@/lib/admin-actions';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminAuthor } from '@/db/queries/admin-taxonomy';

const t = getTranslations('es');
const NO_AVATAR = '__no-avatar__';

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
  const id = useId();
  const avatarId = `${id}-avatar`;
  const [avatarMediaId, setAvatarMediaId] = useState(author?.avatarMediaId ?? '');
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
      <FieldGroup className="grid gap-4 md:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('admin.authors.name')}
          name="name"
          defaultValue={author?.name}
          required
        />
        <TextField
          id={`${id}-slug`}
          label={t('admin.authors.slug')}
          name="slug"
          defaultValue={author?.slug}
          required
        />
        <TextField
          id={`${id}-website`}
          label={t('admin.authors.website')}
          name="websiteUrl"
          type="url"
          defaultValue={author?.websiteUrl ?? ''}
        />
        <Field className="gap-1">
          <FieldLabel htmlFor={avatarId}>{t('admin.authors.avatar')}</FieldLabel>
          <Select
            value={avatarMediaId || NO_AVATAR}
            items={[
              { value: NO_AVATAR, label: t('admin.common.none') },
              ...media.map((asset) => ({
                value: asset.id,
                label: asset.altText || asset.r2Key,
              })),
            ]}
            onValueChange={(value) => setAvatarMediaId(value === NO_AVATAR ? '' : (value ?? ''))}
          >
            <SelectTrigger id={avatarId} className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_AVATAR}>{t('admin.common.none')}</SelectItem>
                {media.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.altText || asset.r2Key}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input type="hidden" name="avatarMediaId" value={avatarMediaId} />
        </Field>
        <TextAreaField
          id={`${id}-bio`}
          className="md:col-span-2"
          label={t('admin.authors.bio')}
          name="bio"
          defaultValue={author?.bio ?? ''}
          rows={4}
        />
        <TextAreaField
          id={`${id}-same-as`}
          className="md:col-span-2"
          label={t('admin.authors.sameAs')}
          name="sameAs"
          defaultValue={sameAs.join('\n')}
          rows={3}
        />
      </FieldGroup>
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

function TextField({
  id,
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; name: string }) {
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} className="h-10" {...props} />
    </Field>
  );
}

function TextAreaField({
  id,
  label,
  name,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  name: string;
}) {
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea id={id} name={name} className="p-3" {...props} />
    </Field>
  );
}
