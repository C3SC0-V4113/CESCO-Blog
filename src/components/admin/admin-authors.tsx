import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAsyncTransition } from '@/hooks/use-async-transition';
import { getTranslations } from '@/i18n/utils';
import { callCreateAuthor, callRetryPendingPurges, callUpdateAuthor } from '@/lib/admin-actions';

import { TextAreaField, TextField } from './admin-fields';
import { FormStatus, PendingButton } from './admin-form';

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
  const sameAsHelpId = `${id}-same-as-help`;
  const [avatarMediaId, setAvatarMediaId] = useState(author?.avatarMediaId ?? '');
  const [isPending, runTransition] = useAsyncTransition();
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
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
  const retryCache = () => {
    setStatus('idle');
    runTransition(async () => {
      const result = await callRetryPendingPurges();
      setStatus(result.error ? 'error' : result.data.status === 'purged' ? 'success' : 'warning');
    });
  };
  const sameAs = Array.isArray(author?.sameAs)
    ? author.sameAs.filter((value): value is string => typeof value === 'string')
    : [];
  return (
    <form
      className="grid gap-4 rounded-xl border bg-background p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setStatus('idle');
        runTransition(async () => {
          await save(form);
        });
      }}
    >
      <h2 className="text-lg font-semibold">{author ? author.name : t('admin.authors.new')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id={`${id}-name`}
          label={t('admin.authors.name')}
          name="name"
          defaultValue={author?.name}
          autoComplete="off"
          required
        />
        <TextField
          id={`${id}-slug`}
          label={t('admin.authors.slug')}
          name="slug"
          defaultValue={author?.slug}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <TextField
          id={`${id}-website`}
          label={t('admin.authors.website')}
          name="websiteUrl"
          type="url"
          inputMode="url"
          defaultValue={author?.websiteUrl ?? ''}
        />
        <Field spacing="compact">
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
            <SelectTrigger id={avatarId}>
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
          layout="wide"
          label={t('admin.authors.bio')}
          name="bio"
          defaultValue={author?.bio ?? ''}
          rows={4}
        />
        <TextAreaField
          id={`${id}-same-as`}
          layout="wide"
          label={t('admin.authors.sameAs')}
          name="sameAs"
          defaultValue={sameAs.join('\n')}
          aria-describedby={sameAsHelpId}
          spellCheck={false}
          rows={3}
        />
        <FieldDescription id={sameAsHelpId} className="md:col-span-2">
          {t('admin.authors.sameAsHelp')}
        </FieldDescription>
      </div>
      <AuthorFormActions
        status={status}
        isPending={isPending}
        canRetry={Boolean(status === 'warning' && author)}
        onRetry={retryCache}
      />
    </form>
  );
}

function AuthorFormActions({
  status,
  isPending,
  canRetry,
  onRetry,
}: {
  status: 'idle' | 'success' | 'warning' | 'error';
  isPending: boolean;
  canRetry: boolean;
  onRetry(): void;
}) {
  return (
    <div className="flex items-center gap-3">
      <PendingButton type="submit" pending={isPending}>
        {t('admin.common.save')}
      </PendingButton>
      <FormStatus
        message={
          !isPending && status === 'success'
            ? t('admin.common.saved')
            : !isPending && status === 'warning'
              ? t('admin.common.cacheWarning')
              : undefined
        }
        error={!isPending && status === 'error' ? t('admin.common.error') : undefined}
      />
      {canRetry && status === 'warning' && !isPending && (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t('admin.common.retryCache')}
        </Button>
      )}
    </div>
  );
}
