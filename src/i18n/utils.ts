import { fromDbTimestamp } from '@/lib/timestamps';

import { defaultLocale, isLocale, type Locale } from './locales';
import { ui, type UiKey } from './ui';

/**
 * UI string access (ADR-0027).
 *
 * The locale always comes from the URL, never from `Accept-Language`
 * (ADR-0008), so callers pass `Astro.currentLocale` rather than negotiating.
 *
 * Named `getTranslations`, not `useTranslations` as Astro's own i18n recipe has
 * it. This is a plain function returning a closure, and it is called from
 * `.astro` frontmatter — but the `use` prefix is reserved for React hooks, and
 * this project has real ones coming with the admin. A non-hook wearing the
 * prefix trips every React-aware linter and, worse, reads like a hook inside an
 * island where the distinction matters.
 */
export function getTranslations(locale: Locale) {
  return function t(key: UiKey): string {
    return ui[locale][key];
  };
}

/**
 * Narrows an unknown locale — `Astro.currentLocale` is `string | undefined` —
 * to a supported one, falling back to the default.
 */
export function resolveLocale(locale: string | undefined): Locale {
  return isLocale(locale) ? locale : defaultLocale;
}

/**
 * Locale-aware date formatting with no dependency — `Intl` is native in Workers.
 * Input is a stored timestamp in the canonical D1 format; see
 * `src/lib/timestamps.ts` for why that format is not ISO.
 */
export function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(fromDbTimestamp(value));
}

/**
 * Tags passed to `Intl`. Spanish is deliberately region-less: the site targets
 * the whole Spanish-speaking audience, so it makes no regional claim. English
 * uses `en-US` because its date order genuinely differs by region and one has to
 * be chosen. See ADR-0027.
 */
const localeTag: Record<Locale, string> = {
  es: 'es',
  en: 'en-US',
};
