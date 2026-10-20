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
const statusKey = (status: AdminLocaleStatus) => `admin.posts.locale.${status}` as UiKey;

function LocaleCell({ post, locale }: { post: AdminPostSummary; locale: 'es' | 'en' }) {
  const id = post.localizationIds[locale];
  const [state, setState] = useState<
    'idle' | 'pending' | 'feature-error' | 'cache-warning' | 'cache-error'
  >('idle');
  const featured = post.featured[locale] ?? false;
  const label = t(statusKey(post.locales[locale]));
  const name = (action: string) =>
    interpolate(t('admin.posts.rowAction'), {
      action,
      title: post.displayName,
      locale: t(`locale.${locale}`),
    });
  if (!id) return <span>{label}</span>;
  const toggleFeatured = () => {
    setState('pending');
    void callSetFeatured({ localizationId: id, featured: !featured })
      .then((result) => {
        if (result.error) {
          setState('feature-error');
        } else if (result.data.status.includes('warning')) {
          setState('cache-warning');
        } else window.location.reload();
      })
      .catch(() => setState('feature-error'));
  };
  const retryCache = () => {
    setState('pending');
    void callRetryPendingPurges()
      .then((result) => {
        if (result.error || result.data.status !== 'purged') {
          setState('cache-error');
        } else window.location.reload();
      })
      .catch(() => setState('cache-error'));
  };
  const cacheWarning = state === 'cache-warning' || state === 'cache-error';
  const pending = state === 'pending';
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
      {(state === 'feature-error' || state === 'cache-error') && (
        <p role="alert" className="text-xs text-destructive">
          {t(state === 'cache-error' ? 'admin.common.error' : 'admin.posts.featureError')}
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
          <Table className="min-w-2xl text-left">
            <TableCaption className="sr-only">{t('admin.posts.caption')}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('admin.posts.title')}</TableHead>
                <TableHead scope="col">{t('admin.posts.section')}</TableHead>
                <TableHead scope="col">{t('locale.es')}</TableHead>
                <TableHead scope="col">{t('locale.en')}</TableHead>
                <TableHead scope="col">{t('admin.posts.state')}</TableHead>
                <TableHead scope="col">{t('post.updatedOn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableHead scope="row" className="max-w-64 truncate p-4">
                    {post.displayName}
                  </TableHead>
                  <TableCell>
                    {t(post.section === 'analysis' ? 'nav.analysis' : 'nav.opinion')}
                  </TableCell>
                  <TableCell>
                    <LocaleCell post={post} locale="es" />
                  </TableCell>
                  <TableCell>
                    <LocaleCell post={post} locale="en" />
                  </TableCell>
                  <TableCell>{t(`admin.posts.state.${post.editorialState}` as UiKey)}</TableCell>
                  <TableCell>{formatDate(post.updatedAt, 'es')}</TableCell>
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
