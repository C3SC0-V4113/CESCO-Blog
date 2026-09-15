import {
  BookOpenIcon,
  FileTextIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  MenuIcon,
  SearchCheckIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { cn } from '@/lib/utils';

import { AdminAuthors } from './admin-authors';
import { AdminCollectionEditor, AdminCollections } from './admin-collections';
import { AdminDashboard } from './admin-dashboard';
import { AdminEditor } from './admin-editor';
import { AdminMedia } from './admin-media';
import { AdminPostForm } from './admin-post-form';
import { AdminPostList } from './admin-post-list';
import { AdminReview } from './admin-review';
import { AdminSeo } from './admin-seo';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminPostSummary } from '@/db/queries/admin-posts';
import type { ReviewDetail, ReviewQueueItem } from '@/db/queries/admin-review';
import type {
  AdminAuthor,
  AdminCollectionDetail,
  AdminCollectionSummary,
  AdminMembershipPost,
  AdminSeoState,
} from '@/db/queries/admin-taxonomy';
import type { EditorDraft, EditorLocalizations } from '@/lib/drafts';

const t = getTranslations('es');

type Screen =
  | { name: 'dashboard' }
  | { name: 'posts'; posts: AdminPostSummary[]; page: number; total: number }
  | { name: 'new-post' }
  | { name: 'authors'; authors: AdminAuthor[]; media: AdminMediaAsset[] }
  | { name: 'collections'; collections: AdminCollectionSummary[] }
  | { name: 'collection-editor'; collection: AdminCollectionDetail; posts: AdminMembershipPost[] }
  | {
      name: 'seo';
      seo: AdminSeoState;
      authors: AdminAuthor[];
      media: AdminMediaAsset[];
      canonical: string;
    }
  | { name: 'media'; assets: AdminMediaAsset[]; page: number; total: number }
  | {
      name: 'review';
      items: ReviewQueueItem[];
      detail: ReviewDetail | null;
      page: number;
      pageSize: number;
      total: number;
      pendingPurges: number;
    }
  | {
      name: 'editor';
      postId: string;
      localizationId: string;
      localizations: EditorLocalizations;
      draft: EditorDraft;
      mediaAssets: AdminMediaAsset[];
      referencedAssets: AdminMediaAsset[];
      mediaTotal: number;
    };

const screenCopy = {
  dashboard: ['admin.title', 'admin.subtitle'],
  posts: ['admin.posts.title', 'admin.posts.subtitle'],
  'new-post': ['admin.posts.new', 'admin.posts.newSubtitle'],
  editor: ['admin.editor.title', 'admin.editor.subtitle'],
  media: ['admin.media.title', 'admin.media.subtitle'],
  review: ['admin.review.title', 'admin.review.subtitle'],
  authors: ['admin.authors.title', 'admin.authors.subtitle'],
  collections: ['admin.collections.title', 'admin.collections.subtitle'],
  'collection-editor': ['admin.collections.editTitle', 'admin.collections.editSubtitle'],
  seo: ['admin.seo.pageTitle', 'admin.seo.pageSubtitle'],
} as const;

const subscribeToNothing = () => () => {};

/**
 * False for the server render and the hydration pass, true once React owns the
 * DOM. Every admin form is controlled, so text typed into a server-rendered
 * input before hydration is reset to the server value when React commits — the
 * edit vanishes with no error. WebKit reaches that commit late enough for an
 * editor, and the e2e suite, to lose the first field typed.
 */
function useHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}

export function AdminApp({ screen = { name: 'dashboard' } }: { screen?: Screen }) {
  const isHydrated = useHydrated();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigationLabel = isNavigationOpen
    ? t('admin.navigation.close')
    : t('admin.navigation.open');
  const NavigationIcon = isNavigationOpen ? XIcon : MenuIcon;
  const isPosts = ['posts', 'new-post', 'editor', 'seo'].includes(screen.name);
  const isMedia = screen.name === 'media';
  const isReview = screen.name === 'review';
  const isCollections = ['collections', 'collection-editor'].includes(screen.name);
  const isAuthors = screen.name === 'authors';
  const [title, subtitle] = screenCopy[screen.name];

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label={navigationLabel}
            aria-controls="admin-navigation"
            aria-expanded={isNavigationOpen}
            onClick={() => setIsNavigationOpen((open) => !open)}
          >
            <NavigationIcon aria-hidden="true" />
          </Button>
          <span className="font-heading text-lg font-semibold">{t('admin.brand')}</span>
          <span className="text-sm text-muted-foreground">{t('admin.navigation')}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[15rem_1fr]">
        <aside
          id="admin-navigation"
          className={cn(
            'flex-col border-b bg-background p-4 md:flex md:min-h-[calc(100dvh-4rem)] md:border-r md:border-b-0',
            isNavigationOpen ? 'flex' : 'hidden'
          )}
        >
          <nav aria-label={t('admin.navigation')} className="flex flex-col gap-1">
            <a
              href="/admin"
              aria-current={screen.name === 'dashboard' ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                screen.name === 'dashboard' && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <LayoutDashboardIcon data-icon="inline-start" />
              {t('admin.navigation.dashboard')}
            </a>
            <a
              href="/admin/media"
              aria-current={isMedia ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                isMedia && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <ImagesIcon data-icon="inline-start" />
              {t('admin.navigation.media')}
            </a>
            <a
              href="/admin/posts"
              aria-current={isPosts ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                isPosts && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <FileTextIcon data-icon="inline-start" />
              {t('admin.navigation.posts')}
            </a>
            <a
              href="/admin/review"
              aria-current={isReview ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                isReview && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <SearchCheckIcon data-icon="inline-start" />
              {t('admin.navigation.review')}
            </a>
            <a
              href="/admin/collections"
              aria-current={isCollections ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                isCollections && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <BookOpenIcon data-icon="inline-start" />
              {t('admin.navigation.collections')}
            </a>
            <a
              href="/admin/authors"
              aria-current={isAuthors ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'justify-start',
                isAuthors && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <UsersIcon data-icon="inline-start" />
              {t('admin.navigation.authors')}
            </a>
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(title)}</h1>
            <p className="text-muted-foreground">{t(subtitle)}</p>
          </div>
          {/* A disabled fieldset makes every control inside it inert until
              hydration, so nothing can be typed that React would discard.
              `contents` keeps it out of the layout. */}
          <fieldset disabled={!isHydrated} className="contents">
            {screen.name === 'dashboard' && <AdminDashboard />}
            {screen.name === 'posts' && (
              <AdminPostList posts={screen.posts} page={screen.page} total={screen.total} />
            )}
            {screen.name === 'new-post' && <AdminPostForm />}
            {screen.name === 'editor' && <AdminEditor {...screen} />}
            {screen.name === 'media' && (
              <AdminMedia assets={screen.assets} page={screen.page} total={screen.total} />
            )}
            {screen.name === 'review' && <AdminReview {...screen} />}
            {screen.name === 'authors' && (
              <AdminAuthors authors={screen.authors} media={screen.media} />
            )}
            {screen.name === 'collections' && <AdminCollections collections={screen.collections} />}
            {screen.name === 'collection-editor' && (
              <AdminCollectionEditor collection={screen.collection} posts={screen.posts} />
            )}
            {screen.name === 'seo' && <AdminSeo {...screen} />}
          </fieldset>
        </main>
      </div>
    </div>
  );
}
