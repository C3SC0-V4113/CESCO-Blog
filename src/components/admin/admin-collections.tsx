import { useId, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
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
import {
  callCreateCollection,
  callRetryPendingPurges,
  callSaveCollection,
} from '@/lib/admin-actions';
import { pickCollectionLocalizations } from '@/lib/admin-taxonomy';
import { cn } from '@/lib/utils';

import type {
  AdminCollectionDetail,
  AdminCollectionSummary,
  AdminMembershipPost,
} from '@/db/queries/admin-taxonomy';
import type { UiKey } from '@/i18n/ui';

const t = getTranslations('es');

const saveErrorCopy: Partial<Record<string, UiKey>> = {
  'collection-slug-reserved': 'admin.collections.slugReserved',
  'collection-slug-locked': 'admin.collections.slugLockedError',
};

export function AdminCollections({ collections }: { collections: AdminCollectionSummary[] }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-5">
      <Button
        className="justify-self-end"
        disabled={pending}
        onClick={() => {
          setPending(true);
          const id = crypto.randomUUID();
          void callCreateCollection({ id }).then((result) => {
            if (result.error) setPending(false);
            else window.location.assign(`/admin/collections/${id}`);
          });
        }}
      >
        {t('admin.collections.new')}
      </Button>
      {collections.length ? (
        <ul className="grid gap-3">
          {collections.map((collection) => {
            const label =
              collection.localizations.find(({ locale }) => locale === 'es')?.title ??
              collection.localizations[0]?.title ??
              collection.id;
            return (
              <li key={collection.id} className="rounded-xl border bg-background p-4">
                <a
                  className={cn(buttonVariants({ variant: 'link' }), 'px-0')}
                  href={`/admin/collections/${collection.id}`}
                >
                  {label}
                </a>
                <p className="text-sm text-muted-foreground">
                  {t(`admin.posts.state.${collection.editorialState}`)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{t('admin.collections.empty')}</p>
      )}
    </div>
  );
}

export function AdminCollectionEditor({
  collection,
  posts,
}: {
  collection: AdminCollectionDetail;
  posts: AdminMembershipPost[];
}) {
  const [postIds, setPostIds] = useState(() => collection.postIds);
  const [status, setStatus] = useState<'idle' | 'pending' | 'saved' | 'warning' | 'error'>('idle');
  const [error, setError] = useState<UiKey>('admin.common.error');
  const [localizationIds] = useState(() => ({
    es: collection.localizations.find(({ locale }) => locale === 'es')?.id ?? crypto.randomUUID(),
    en: collection.localizations.find(({ locale }) => locale === 'en')?.id ?? crypto.randomUUID(),
  }));
  const fail = (key: UiKey) => {
    setError(key);
    setStatus('error');
  };
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const read = (locale: 'es' | 'en') => ({
      id: localizationIds[locale],
      slug: String(data.get(`${locale}-slug`) ?? ''),
      title: String(data.get(`${locale}-title`) ?? ''),
      description: String(data.get(`${locale}-description`) ?? ''),
      status: String(data.get(`${locale}-status`)) as 'draft' | 'published' | 'archived',
    });
    const { localizations, incomplete } = pickCollectionLocalizations(
      { es: read('es'), en: read('en') },
      new Set(collection.localizations.map(({ locale }) => locale))
    );
    if (incomplete[0]) return fail(`admin.collections.incomplete.${incomplete[0]}`);
    if (!localizations.length) return fail('admin.collections.localeRequired');
    setStatus('pending');
    const result = await callSaveCollection({
      id: collection.id,
      editorialState: String(data.get('editorialState')) as 'active' | 'archived',
      localizations,
      postIds,
    });
    if (result.error) fail(saveErrorCopy[result.error.message] ?? 'admin.common.error');
    else setStatus(result.data.status.includes('warning') ? 'warning' : 'saved');
  };
  const selectedPostIds = new Set(postIds);
  const available = posts.filter(({ id }) => !selectedPostIds.has(id));
  return (
    <form>
      <FieldGroup className="gap-6">
        <Field className="gap-1">
          <FieldLabel htmlFor="collection-editorial-state">
            {t('admin.collections.lifecycle')}
          </FieldLabel>
          <Select
            name="editorialState"
            defaultValue={collection.editorialState}
            items={[
              { value: 'active', label: t('admin.posts.state.active') },
              { value: 'archived', label: t('admin.posts.state.archived') },
            ]}
          >
            <SelectTrigger id="collection-editorial-state" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="active">{t('admin.posts.state.active')}</SelectItem>
                <SelectItem value="archived">{t('admin.posts.state.archived')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-5 lg:grid-cols-2">
          {(['es', 'en'] as const).map((locale) => {
            const current = collection.localizations.find((item) => item.locale === locale);
            const locked = Boolean(current?.firstPublishedAt);
            return (
              <fieldset key={locale} className="grid gap-3 rounded-xl border bg-background p-5">
                <legend className="px-2 font-semibold">{t(`locale.${locale}`)}</legend>
                <TextField
                  name={`${locale}-title`}
                  label={t('admin.collections.fieldTitle')}
                  defaultValue={current?.title}
                />
                <TextField
                  name={`${locale}-slug`}
                  label={t('admin.collections.slug')}
                  defaultValue={current?.slug}
                  readOnly={locked}
                />
                {locked && (
                  <p className="text-sm text-muted-foreground">
                    {t('admin.collections.slugLocked')}
                  </p>
                )}
                <Field className="gap-1">
                  <FieldLabel htmlFor={`collection-${locale}-description`}>
                    {t('admin.collections.description')}
                  </FieldLabel>
                  <Textarea
                    id={`collection-${locale}-description`}
                    name={`${locale}-description`}
                    defaultValue={current?.description ?? ''}
                    className="min-h-24 p-3"
                  />
                </Field>
                <Field className="gap-1">
                  <FieldLabel htmlFor={`collection-${locale}-status`}>
                    {t('admin.collections.status')}
                  </FieldLabel>
                  <Select
                    name={`${locale}-status`}
                    defaultValue={current?.status ?? 'draft'}
                    items={[
                      { value: 'draft', label: t('admin.posts.locale.draft') },
                      { value: 'published', label: t('admin.posts.locale.published') },
                      { value: 'archived', label: t('admin.posts.locale.archived') },
                    ]}
                  >
                    <SelectTrigger id={`collection-${locale}-status`} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="draft">{t('admin.posts.locale.draft')}</SelectItem>
                        <SelectItem value="published">
                          {t('admin.posts.locale.published')}
                        </SelectItem>
                        <SelectItem value="archived">{t('admin.posts.locale.archived')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </fieldset>
            );
          })}
        </div>
        <section className="grid gap-3 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">{t('admin.collections.members')}</h2>
          {postIds.map((id, index) => {
            const post = posts.find((item) => item.id === id);
            return (
              <div key={id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <span className="grow">
                  {index + 1}. {post?.title ?? id}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() =>
                    setPostIds((items) =>
                      items.map((value, position) =>
                        position === index - 1 ? id : position === index ? items[index - 1]! : value
                      )
                    )
                  }
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={index === postIds.length - 1}
                  onClick={() =>
                    setPostIds((items) =>
                      items.map((value, position) =>
                        position === index + 1 ? id : position === index ? items[index + 1]! : value
                      )
                    )
                  }
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPostIds((items) => items.filter((value) => value !== id))}
                >
                  {t('admin.collections.remove')}
                </Button>
              </div>
            );
          })}
          <Field className="gap-1">
            <FieldLabel htmlFor="collection-add-post">{t('admin.collections.add')}</FieldLabel>
            <Select
              value={null}
              items={available.map((post) => ({ value: post.id, label: post.title }))}
              onValueChange={(value) => {
                if (value) setPostIds((items) => [...items, value]);
              }}
            >
              <SelectTrigger id="collection-add-post" className="h-10 w-full">
                <SelectValue placeholder={t('admin.collections.choose')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {available.map((post) => (
                    <SelectItem key={post.id} value={post.id}>
                      {post.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </section>
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
              ? t(error)
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
      </FieldGroup>
    </form>
  );
}

function TextField({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const id = useId();
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} className="h-10" {...props} />
    </Field>
  );
}
