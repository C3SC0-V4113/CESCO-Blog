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
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { cn } from '@/lib/utils';

import { AdminDashboard } from './admin-dashboard';
import { AdminEditor } from './admin-editor';
import { AdminMedia } from './admin-media';
import { AdminPostForm } from './admin-post-form';
import { AdminPostList } from './admin-post-list';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { AdminPostSummary } from '@/db/queries/admin-posts';
import type { UiKey } from '@/i18n/ui';
import type { EditorDraft, EditorLocalizations } from '@/lib/drafts';
import type { LucideIcon } from 'lucide-react';

const t = getTranslations('es');

type Screen =
  | { name: 'dashboard' }
  | { name: 'posts'; posts: AdminPostSummary[]; page: number; total: number }
  | { name: 'new-post' }
  | { name: 'media'; assets: AdminMediaAsset[]; page: number; total: number }
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

const laterDestinations: Array<{ label: UiKey; icon: LucideIcon }> = [
  { label: 'admin.navigation.review', icon: SearchCheckIcon },
  { label: 'admin.navigation.collections', icon: BookOpenIcon },
  { label: 'admin.navigation.authors', icon: UsersIcon },
];
const screenCopy = {
  dashboard: ['admin.title', 'admin.subtitle'],
  posts: ['admin.posts.title', 'admin.posts.subtitle'],
  'new-post': ['admin.posts.new', 'admin.posts.newSubtitle'],
  editor: ['admin.editor.title', 'admin.editor.subtitle'],
  media: ['admin.media.title', 'admin.media.subtitle'],
} as const;

export function AdminApp({ screen = { name: 'dashboard' } }: { screen?: Screen }) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigationLabel = isNavigationOpen
    ? t('admin.navigation.close')
    : t('admin.navigation.open');
  const NavigationIcon = isNavigationOpen ? XIcon : MenuIcon;
  const isPosts = ['posts', 'new-post', 'editor'].includes(screen.name);
  const isMedia = screen.name === 'media';
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
            {laterDestinations.map(({ label, icon: Icon }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                className="justify-start"
                disabled
                title={t('admin.navigation.pending')}
              >
                <Icon data-icon="inline-start" aria-hidden="true" />
                {t(label)}
              </Button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(title)}</h1>
            <p className="text-muted-foreground">{t(subtitle)}</p>
          </div>
          {screen.name === 'dashboard' && <AdminDashboard />}
          {screen.name === 'posts' && (
            <AdminPostList posts={screen.posts} page={screen.page} total={screen.total} />
          )}
          {screen.name === 'new-post' && <AdminPostForm />}
          {screen.name === 'editor' && <AdminEditor {...screen} />}
          {screen.name === 'media' && (
            <AdminMedia assets={screen.assets} page={screen.page} total={screen.total} />
          )}
        </main>
      </div>
    </div>
  );
}
