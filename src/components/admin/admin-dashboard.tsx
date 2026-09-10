import { Clock3Icon, FilePenLineIcon, LanguagesIcon } from 'lucide-react';

import { getTranslations } from '@/i18n/utils';

import type { UiKey } from '@/i18n/ui';
import type { LucideIcon } from 'lucide-react';

const t = getTranslations('es');

const dashboardSections: Array<{ title: UiKey; icon: LucideIcon }> = [
  { title: 'admin.dashboard.drafts', icon: FilePenLineIcon },
  { title: 'admin.dashboard.locales', icon: LanguagesIcon },
  { title: 'admin.dashboard.activity', icon: Clock3Icon },
];

export function AdminDashboard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {dashboardSections.map(({ title, icon: Icon }) => (
        <section
          key={title}
          aria-labelledby={`${title}-heading`}
          className="flex min-h-52 flex-col rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon aria-hidden="true" />
            </span>
            <h2 id={`${title}-heading`} className="text-base font-semibold">
              {t(title)}
            </h2>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="font-medium">{t('admin.dashboard.empty')}</p>
            <p className="max-w-64 text-sm text-muted-foreground">
              {t('admin.dashboard.emptyDescription')}
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
