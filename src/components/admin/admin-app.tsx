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

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { cn } from '@/lib/utils';

import { AdminDashboard } from './admin-dashboard';

import type { UiKey } from '@/i18n/ui';
import type { LucideIcon } from 'lucide-react';

const t = getTranslations('es');

const pendingDestinations: Array<{ label: UiKey; icon: LucideIcon }> = [
  { label: 'admin.navigation.posts', icon: FileTextIcon },
  { label: 'admin.navigation.media', icon: ImagesIcon },
  { label: 'admin.navigation.review', icon: SearchCheckIcon },
  { label: 'admin.navigation.collections', icon: BookOpenIcon },
  { label: 'admin.navigation.authors', icon: UsersIcon },
];

export function AdminApp() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigationLabel = isNavigationOpen
    ? t('admin.navigation.close')
    : t('admin.navigation.open');
  const NavigationIcon = isNavigationOpen ? XIcon : MenuIcon;

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
            <div
              aria-current="page"
              className="flex h-9 items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-sm font-medium text-sidebar-accent-foreground"
            >
              <LayoutDashboardIcon aria-hidden="true" />
              {t('admin.navigation.dashboard')}
            </div>
            {pendingDestinations.map(({ label, icon: Icon }) => (
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
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('admin.title')}
            </h1>
            <p className="text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
          <AdminDashboard />
        </main>
      </div>
    </div>
  );
}
