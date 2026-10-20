import { cva } from 'class-variance-authority';
import { PlusIcon, StarIcon } from 'lucide-react';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, getTranslations, interpolate } from '@/i18n/utils';
import { callRetryPendingPurges, callSetFeatured } from '@/lib/admin-actions';
import { pageCount } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import type { AdminLocaleStatus, AdminPostSummary } from '@/db/queries/admin-posts';
import type { UiKey } from '@/i18n/ui';

const t = getTranslations('es');
const adminPostsTableVariants = cva('', {
  variants: {
    part: {
      table: 'min-w-2xl text-left',
      caption: 'sr-only',
      header: 'bg-muted/50 text-xs text-muted-foreground',
      headerRow: 'border-b-0 transition-none hover:bg-transparent',
      column: 'px-4 py-3 font-medium',
      body: 'divide-y',
      row: 'border-0 transition-none hover:bg-transparent',
      title: 'max-w-64 truncate p-4 font-medium',
      cell: 'p-4',
      date: 'p-4 whitespace-nowrap',
    },
  },
});
const statusKey = (status: AdminLocaleStatus) => `admin.posts.locale.${status}` as UiKey;

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
        className={buttonVariants({ variant: 'link', size: 'xs' })}
        href={`/admin/posts/${post.id}/edit?localization=${id}`}
        aria-label={name(label)}
      >
        {label}
      </a>
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          className={buttonVariants({ variant: 'link', size: 'xs' })}
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
              size="tight"
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
        <div className="rounded-xl border bg-card shadow-sm">
          <Table className={adminPostsTableVariants({ part: 'table' })}>
            <TableCaption className={adminPostsTableVariants({ part: 'caption' })}>
              {t('admin.posts.caption')}
            </TableCaption>
            <TableHeader className={adminPostsTableVariants({ part: 'header' })}>
              <TableRow className={adminPostsTableVariants({ part: 'headerRow' })}>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('admin.posts.title')}
                </TableHead>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('admin.posts.section')}
                </TableHead>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('locale.es')}
                </TableHead>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('locale.en')}
                </TableHead>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('admin.posts.state')}
                </TableHead>
                <TableHead scope="col" className={adminPostsTableVariants({ part: 'column' })}>
                  {t('post.updatedOn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={adminPostsTableVariants({ part: 'body' })}>
              {posts.map((post) => (
                <TableRow key={post.id} className={adminPostsTableVariants({ part: 'row' })}>
                  <TableHead scope="row" className={adminPostsTableVariants({ part: 'title' })}>
                    {post.displayName}
                  </TableHead>
                  <TableCell className={adminPostsTableVariants({ part: 'cell' })}>
                    {t(post.section === 'analysis' ? 'nav.analysis' : 'nav.opinion')}
                  </TableCell>
                  <TableCell className={adminPostsTableVariants({ part: 'cell' })}>
                    <LocaleCell post={post} locale="es" />
                  </TableCell>
                  <TableCell className={adminPostsTableVariants({ part: 'cell' })}>
                    <LocaleCell post={post} locale="en" />
                  </TableCell>
                  <TableCell className={adminPostsTableVariants({ part: 'cell' })}>
                    {t(`admin.posts.state.${post.editorialState}` as UiKey)}
                  </TableCell>
                  <TableCell className={adminPostsTableVariants({ part: 'date' })}>
                    {formatDate(post.updatedAt, 'es')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
