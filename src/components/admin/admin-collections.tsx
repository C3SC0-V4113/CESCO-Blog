import { useState } from 'react';
import { flushSync } from 'react-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import {
  callCreateCollection,
  callRetryPendingPurges,
  callSaveCollection,
} from '@/lib/admin-actions';
import { pickCollectionLocalizations } from '@/lib/admin-taxonomy';
import { cn } from '@/lib/utils';

import {
  FieldError,
  inputClass,
  invalidField,
  PendingButton,
  selectClass,
  textareaClass,
} from './admin-form';

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
  const [invalid, setInvalid] = useState<{ name: string; message: UiKey }>();
  const [localizationIds] = useState(() => ({
    es: collection.localizations.find(({ locale }) => locale === 'es')?.id ?? crypto.randomUUID(),
    en: collection.localizations.find(({ locale }) => locale === 'en')?.id ?? crypto.randomUUID(),
  }));
  const fail = (key: UiKey) => {
    setError(key);
    setStatus('error');
  };
  // Rendered before the move, so the field is already marked invalid and
  // described by its message when focus lands on it.
  const failField = (form: HTMLFormElement, name: string, message: UiKey) => {
    flushSync(() => {
      setInvalid({ name, message });
      setStatus('idle');
    });
    (form.elements.namedItem(name) as HTMLElement | null)?.focus();
  };
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setInvalid(undefined);
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
    const [locale] = incomplete;
    if (locale) {
      const field = String(data.get(`${locale}-title`) ?? '').trim() ? 'slug' : 'title';
      return failField(form, `${locale}-${field}`, `admin.collections.incomplete.${locale}`);
    }
    if (!localizations.length)
      return failField(form, 'es-title', 'admin.collections.localeRequired');
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
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <label>
        {t('admin.collections.lifecycle')}
        <select
          name="editorialState"
          defaultValue={collection.editorialState}
          className={cn('mt-1', selectClass)}
        >
          <option value="active">{t('admin.posts.state.active')}</option>
          <option value="archived">{t('admin.posts.state.archived')}</option>
        </select>
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        {(['es', 'en'] as const).map((locale) => {
          const current = collection.localizations.find((item) => item.locale === locale);
          const locked = Boolean(current?.firstPublishedAt);
          return (
            <fieldset key={locale} className="grid gap-3 rounded-xl border bg-background p-5">
              <legend className="px-2 font-semibold">{t(`locale.${locale}`)}</legend>
              <Field
                name={`${locale}-title`}
                label={t('admin.collections.fieldTitle')}
                defaultValue={current?.title}
                invalid={invalid}
              />
              <Field
                name={`${locale}-slug`}
                label={t('admin.collections.slug')}
                defaultValue={current?.slug}
                readOnly={locked}
                autoComplete="off"
                spellCheck={false}
                invalid={invalid}
              />
              {locked && (
                <p className="text-sm text-muted-foreground">{t('admin.collections.slugLocked')}</p>
              )}
              <label>
                {t('admin.collections.description')}
                <textarea
                  name={`${locale}-description`}
                  defaultValue={current?.description ?? ''}
                  className={cn('mt-1', textareaClass)}
                />
              </label>
              <label>
                {t('admin.collections.status')}
                <select
                  name={`${locale}-status`}
                  defaultValue={current?.status ?? 'draft'}
                  className={cn('mt-1', selectClass)}
                >
                  <option value="draft">{t('admin.posts.locale.draft')}</option>
                  <option value="published">{t('admin.posts.locale.published')}</option>
                  <option value="archived">{t('admin.posts.locale.archived')}</option>
                </select>
              </label>
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
        <label>
          {t('admin.collections.add')}
          <select
            className={cn('mt-1', selectClass)}
            value=""
            onChange={(event) => {
              if (event.target.value) setPostIds((items) => [...items, event.target.value]);
            }}
          >
            <option value="">{t('admin.collections.choose')}</option>
            {available.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="flex items-center gap-3">
        <PendingButton type="submit" pending={status === 'pending'}>
          {t('admin.common.save')}
        </PendingButton>
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
    </form>
  );
}

function Field({
  label,
  name,
  invalid,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  invalid?: { name: string; message: UiKey };
}) {
  const message = invalid?.name === name ? invalid.message : undefined;
  return (
    <div>
      <label>
        {label}
        <input
          name={name}
          className={cn('mt-1', inputClass)}
          {...invalidField(name, Boolean(message))}
          {...props}
        />
      </label>
      {message && <FieldError name={name}>{t(message)}</FieldError>}
    </div>
  );
}
