import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field as UiField, FieldError as UiFieldError, FieldLabel } from '@/components/ui/field';
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
import { getTranslations, interpolate } from '@/i18n/utils';
import {
  callCreateCollection,
  callRetryPendingPurges,
  callSaveCollection,
} from '@/lib/admin-actions';
import { pickCollectionLocalizations } from '@/lib/admin-taxonomy';
import { cn } from '@/lib/utils';

import { FormStatus, PendingButton } from './admin-form';

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
  const [failed, setFailed] = useState(false);
  const create = async () => {
    setPending(true);
    setFailed(false);
    const id = crypto.randomUUID();
    try {
      const result = await callCreateCollection({ id });
      if (result.error) throw result.error;
      // Still pending while the editor loads.
      window.location.assign(`/admin/collections/${id}`);
    } catch {
      setPending(false);
      setFailed(true);
    }
  };
  return (
    <div className="grid gap-5">
      <div className="grid justify-items-end gap-2">
        <PendingButton type="button" pending={pending} onClick={() => void create()}>
          {t('admin.collections.new')}
        </PendingButton>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {t('admin.collections.createError')}
          </p>
        )}
      </div>
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
  // A move or removal re-renders the rows, so the control that did it is found
  // again by post id and direction. What happened is spoken by a region that
  // is always present, so the change is announced and not just inserted.
  const memberButtons = useRef(new Map<string, HTMLButtonElement>());
  const addSelect = useRef<HTMLButtonElement>(null);
  const [membersStatus, setMembersStatus] = useState('');
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
  const titleOf = (id: string) => posts.find((item) => item.id === id)?.title ?? id;
  const keepButton = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) memberButtons.current.set(key, element);
    else memberButtons.current.delete(key);
  };
  const move = (from: number, to: number) => {
    const id = postIds[from]!;
    const next = postIds.toSpliced(from, 1).toSpliced(to, 0, id);
    flushSync(() => {
      setPostIds(next);
      setMembersStatus(
        interpolate(t('admin.collections.moved'), {
          title: titleOf(id),
          position: to + 1,
          total: next.length,
        })
      );
    });
    // At an edge the button just used is disabled, so the other one takes focus.
    const direction = to < from ? 'up' : 'down';
    const atEdge = to === 0 || to === next.length - 1;
    const other = direction === 'up' ? 'down' : 'up';
    memberButtons.current.get(`${atEdge ? other : direction}:${id}`)?.focus();
  };
  const remove = (index: number) => {
    const id = postIds[index]!;
    const next = postIds.toSpliced(index, 1);
    flushSync(() => {
      setPostIds(next);
      setMembersStatus(interpolate(t('admin.collections.removed'), { title: titleOf(id) }));
    });
    const neighbour = next[index] ?? next[index - 1];
    (neighbour ? memberButtons.current.get(`remove:${neighbour}`) : addSelect.current)?.focus();
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
      <UiField className="gap-1">
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
          <SelectTrigger id="collection-editorial-state" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="active">{t('admin.posts.state.active')}</SelectItem>
              <SelectItem value="archived">{t('admin.posts.state.archived')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </UiField>
      <CollectionLocalizations collection={collection} invalid={invalid} />
      <section className="grid gap-3 rounded-xl border bg-background p-5">
        <h2 className="font-semibold">{t('admin.collections.members')}</h2>
        {postIds.map((id, index) => {
          const title = titleOf(id);
          // Concentric: the buttons' radius-md plus the row's 6px inset.
          return (
            <div
              key={id}
              className="flex flex-wrap items-center gap-2 rounded-xl border py-1.5 pr-1.5 pl-3"
            >
              <span className="grow">
                <span className="tabular-nums">{index + 1}.</span> {title}
              </span>
              <Button
                ref={keepButton(`up:${id}`)}
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={interpolate(t('admin.collections.moveUp'), { title })}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUpIcon aria-hidden="true" />
              </Button>
              <Button
                ref={keepButton(`down:${id}`)}
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={interpolate(t('admin.collections.moveDown'), { title })}
                disabled={index === postIds.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDownIcon aria-hidden="true" />
              </Button>
              <Button
                ref={keepButton(`remove:${id}`)}
                type="button"
                variant="outline"
                size="sm"
                aria-label={interpolate(t('admin.collections.removeMember'), { title })}
                onClick={() => remove(index)}
              >
                {t('admin.collections.remove')}
              </Button>
            </div>
          );
        })}
        <p id="members-status" role="status" className="sr-only">
          {membersStatus}
        </p>
        <UiField className="gap-1">
          <FieldLabel htmlFor="collection-add-post">{t('admin.collections.add')}</FieldLabel>
          <Select
            value={null}
            items={available.map((post) => ({ value: post.id, label: post.title }))}
            onValueChange={(value) => {
              if (value) setPostIds((items) => [...items, value]);
            }}
          >
            <SelectTrigger ref={addSelect} id="collection-add-post" className="w-full">
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
        </UiField>
      </section>
      <div className="flex items-center gap-3">
        <PendingButton type="submit" pending={status === 'pending'}>
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
          error={status === 'error' ? t(error) : undefined}
        />
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
    <UiField data-invalid={Boolean(message)} className="gap-1">
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(message)}
        aria-describedby={message ? `${name}-error` : undefined}
        {...props}
      />
      {message && <UiFieldError id={`${name}-error`}>{t(message)}</UiFieldError>}
    </UiField>
  );
}

function CollectionLocalizations({
  collection,
  invalid,
}: {
  collection: AdminCollectionDetail;
  invalid?: { name: string; message: UiKey };
}) {
  return (
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
            <UiField className="gap-1">
              <FieldLabel htmlFor={`collection-${locale}-description`}>
                {t('admin.collections.description')}
              </FieldLabel>
              <Textarea
                id={`collection-${locale}-description`}
                name={`${locale}-description`}
                defaultValue={current?.description ?? ''}
                className="min-h-20"
              />
            </UiField>
            <UiField className="gap-1">
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
                <SelectTrigger id={`collection-${locale}-status`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="draft">{t('admin.posts.locale.draft')}</SelectItem>
                    <SelectItem value="published">{t('admin.posts.locale.published')}</SelectItem>
                    <SelectItem value="archived">{t('admin.posts.locale.archived')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </UiField>
          </fieldset>
        );
      })}
    </div>
  );
}
