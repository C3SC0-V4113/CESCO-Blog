import { PlusIcon, StarIcon } from 'lucide-react';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { formatDate, getTranslations, interpolate } from '@/i18n/utils';
import { callRetryPendingPurges, callSetFeatured } from '@/lib/admin-actions';
import { pageCount } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import type { AdminLocaleStatus, AdminPostSummary } from '@/db/queries/admin-posts';
import type { UiKey } from '@/i18n/ui';

const t = getTranslations('es');
const statusKey = (status: AdminLocaleStatus) => `admin.posts.locale.${status}` as UiKey;
const textAction =
  'inline-flex min-h-6 items-center underline underline-offset-4 disabled:opacity-50';

function LocaleCell({ post, locale }: { post: AdminPostSummary; locale: 'es' | 'en' }) {
  const id = post.localizationIds[locale];
  const [pending, setPending] = useState(false);
  const [cacheWarning, setCacheWarning] = useState(false);
  const [failed, setFailed] = useState(false);
  const featured = post.featured[locale] ?? false;
  const label = t(statusKey(post.locales[locale]));
  const name = (action: string) =>
    interpolate(t('admin.posts.rowAction'), {
      action,
      title: post.displayName,
      locale: t(`locale.${locale}`),
    });
  if (!id) return <span>{label}</span>;
  const settle = (work: Promise<boolean>) => {
    setPending(true);
    setFailed(false);
    void work
      .catch(() => false)
      .then((done) => {
        if (!done) {
          setPending(false);
          setFailed(true);
        }
      });
  };
  const toggleFeatured = () =>
    settle(
      callSetFeatured({ localizationId: id, featured: !featured }).then((result) => {
        if (result.error) return false;
        if (result.data.status.includes('warning')) {
          setCacheWarning(true);
          setPending(false);
        } else window.location.reload();
        return true;
      })
    );
  const retryCache = () =>
    settle(
      callRetryPendingPurges().then((result) => {
        if (result.error || result.data.status !== 'purged') return false;
        window.location.reload();
        return true;
      })
    );
  // The status stays the way into the editor: it is what an editor scans the
  // table for, and the publish and editor flows locate a draft by it.
  return (
    <div className="grid gap-2">
      <a
        className={textAction}
        href={`/admin/posts/${post.id}/edit?localization=${id}`}
        aria-label={name(label)}
      >
        {label}
      </a>
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          className={textAction}
          href={`/admin/posts/${post.id}/seo?localization=${id}`}
          aria-label={name(t('admin.posts.seo'))}
        >
          {t('admin.posts.seo')}
        </a>
        {post.locales[locale] === 'published' &&
          (cacheWarning ? (
            <Button
              type="button"
              variant="link"
              className={textAction}
              disabled={pending}
              aria-label={name(t('admin.common.retryCache'))}
              onClick={retryCache}
            >
              {t('admin.common.retryCache')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="link"
              className={cn(textAction, 'gap-1')}
              disabled={pending}
              aria-pressed={featured}
              aria-label={name(t('admin.posts.feature'))}
              onClick={toggleFeatured}
            >
              <StarIcon aria-hidden="true" className={cn('size-3', featured && 'fill-current')} />
              {t('admin.posts.feature')}
            </Button>
          ))}
      </div>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t(cacheWarning ? 'admin.common.error' : 'admin.posts.featureError')}
        </p>
      )}
    </div>
  );
}

type AdminPostListProps = { posts: AdminPostSummary[]; page: number; total: number };
export function AdminPostList({ posts, page, total }: AdminPostListProps) {
  const totalPages = pageCount(total);
  return (
    <div className="flex flex-col gap-5">
      <a href="/admin/posts/new" className={cn(buttonVariants(), 'self-end')}>
        <PlusIcon data-icon="inline-start" />
        {t('admin.posts.new')}
      </a>
      {posts.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center font-semibold shadow-sm">
          {t('admin.posts.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-2xl text-left text-sm">
            <caption className="sr-only">{t('admin.posts.caption')}</caption>
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('admin.posts.title')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('admin.posts.section')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('locale.es')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('locale.en')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('admin.posts.state')}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t('post.updatedOn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((post) => (
                <tr key={post.id}>
                  <th scope="row" className="max-w-64 truncate p-4  font-medium">
                    {post.displayName}
                  </th>
                  <td className="p-4 ">
                    {t(post.section === 'analysis' ? 'nav.analysis' : 'nav.opinion')}
                  </td>
                  <td className="p-4 ">
                    <LocaleCell post={post} locale="es" />
                  </td>
                  <td className="p-4 ">
                    <LocaleCell post={post} locale="en" />
                  </td>
                  <td className="p-4 ">
                    {t(`admin.posts.state.${post.editorialState}` as UiKey)}
                  </td>
                  <td className="p-4  whitespace-nowrap">
                    {formatDate(post.updatedAt, 'es')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label={t('listing.pagination')} className="flex justify-center gap-3">
          {page > 1 && (
            <a
              href={page === 2 ? '/admin/posts' : `?page=${page - 1}`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {t('listing.previous')}
            </a>
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a href={`?page=${page + 1}`} className={cn(buttonVariants({ variant: 'outline' }))}>
              {t('listing.next')}
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
