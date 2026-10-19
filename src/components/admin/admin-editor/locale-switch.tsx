import { buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { cn } from '@/lib/utils';

import type { EditorLocalizations } from '@/lib/drafts';

const t = getTranslations('es');
const localeLabel = (locale: 'es' | 'en') => t(`admin.editor.locale.${locale}`);
const pill = 'inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium';

type Props = {
  postId: string;
  localizationId: string;
  localizations: EditorLocalizations;
  flush(): Promise<boolean>;
};

export function LocaleSwitch({ postId, localizationId, localizations, flush }: Props) {
  const currentLocale = localizations.es === localizationId ? 'es' : 'en';

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{t('admin.editor.locale')}</p>
      {/* Only the other locale is a destination. The current one and a
        missing one are plain text, so nothing focusable does nothing. */}
      <div className="flex gap-2" role="group" aria-label={t('admin.editor.locale')}>
        {(['es', 'en'] as const).map((locale) => {
          const id = localizations[locale];
          if (locale === currentLocale)
            return (
              <span
                key={locale}
                aria-current="page"
                className={cn(pill, 'bg-primary text-primary-foreground')}
              >
                {localeLabel(locale)} ({t('admin.editor.locale.current')})
              </span>
            );
          if (!id)
            return (
              <span key={locale} className={cn(pill, 'border border-dashed text-muted-foreground')}>
                {localeLabel(locale)} ({t('admin.editor.locale.missing')})
              </span>
            );
          const href = `/admin/posts/${postId}/edit?localization=${id}`;
          return (
            <a
              key={locale}
              className={buttonVariants({ variant: 'outline' })}
              href={href}
              onClick={(event) => {
                event.preventDefault();
                void flush()
                  .then((saved) => saved && window.location.assign(href))
                  .catch(() => undefined);
              }}
            >
              {localeLabel(locale)}
            </a>
          );
        })}
      </div>
    </div>
  );
}
