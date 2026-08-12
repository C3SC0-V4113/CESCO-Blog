import { PlusIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { formatDate, getTranslations } from '@/i18n/utils';
import { pageCount } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import type { AdminLocaleStatus, AdminPostSummary } from '@/db/queries/admin-posts';
import type { UiKey } from '@/i18n/ui';
const t = getTranslations('es');
const statusKey = (status: AdminLocaleStatus) => `admin.posts.locale.${status}` as UiKey;
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
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.posts.title')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.posts.section')}</th>
                <th className="px-4 py-3 font-medium">{t('locale.es')}</th>
                <th className="px-4 py-3 font-medium">{t('locale.en')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.posts.state')}</th>
                <th className="px-4 py-3 font-medium">{t('post.updatedOn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="max-w-64 truncate px-4 py-4 font-medium">{post.displayName}</td>
                  <td className="px-4 py-4">
                    {t(post.section === 'analysis' ? 'nav.analysis' : 'nav.opinion')}
                  </td>
                  <td className="px-4 py-4">{t(statusKey(post.locales.es))}</td>
                  <td className="px-4 py-4">{t(statusKey(post.locales.en))}</td>
                  <td className="px-4 py-4">
                    {t(`admin.posts.state.${post.editorialState}` as UiKey)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
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
