import { locales } from '@/i18n/locales';
import { articlePath, sectionPath } from '@/lib/urls';

import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

/**
 * Where every fixed page lives, in every locale.
 *
 * This exists because the same knowledge was written down twice. `navigation.ts`
 * held the trust-page paths so the footer could link them, and each page then
 * repeated its own pair inside an `alternates` literal for `hreflang` and the
 * language picker. Two copies of the same fact, and the module holding one of
 * them already warned what that costs: "two copies of what exists drift the
 * first time one is updated."
 *
 * A localized route is a **pair**, not a string. Writing it as a pair is what
 * makes the alternates fall out for free rather than being restated: a page
 * that knows its own key knows every address it has.
 *
 * Pure (ADR-0031), so the mapping is unit-testable without a request.
 */

/** Fixed pages: the trust set (ADR-0018) plus the listings that have no parameters. */
export const routes = {
  home: { es: '/es/', en: '/en/' },
  blog: { es: '/es/blog', en: '/en/blog' },
  series: { es: '/es/series', en: '/en/series' },
  about: { es: '/es/acerca-de', en: '/en/about' },
  contact: { es: '/es/contacto', en: '/en/contact' },
  privacy: { es: '/es/privacidad', en: '/en/privacy' },
  editorialPolicy: { es: '/es/politica-editorial', en: '/en/editorial-policy' },
  disclosures: { es: '/es/divulgaciones', en: '/en/disclosures' },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof routes;

/** One localized address. */
export function routePath(key: RouteKey, locale: Locale): string {
  return routes[key][locale];
}

/**
 * Every locale a fixed page exists in.
 *
 * Fixed pages exist in all of them by definition — they ship with the site
 * rather than being published — which is what separates this from the article
 * case below, where a counterpart may simply not have been written yet.
 */
export function routeAlternates(key: RouteKey): { locale: Locale; path: string }[] {
  return locales.map((locale) => ({ locale, path: routes[key][locale] }));
}

/** Every locale a **section listing** exists in. Derived, because the segment is. */
export function sectionAlternates(section: PostSection): { locale: Locale; path: string }[] {
  return locales.map((locale) => ({ locale, path: sectionPath(locale, section) }));
}

/**
 * Every locale an article is **published** in — not every locale it could be.
 *
 * The caller passes what the query returned, and the query returns published
 * localizations only (ADR-0013). That is the whole difference from the fixed
 * pages above: offering a language here that has not been published yet sends a
 * reader, and a crawler, to a `404`.
 */
export function articleAlternates(
  section: PostSection,
  published: { locale: Locale; slug: string }[]
): { locale: Locale; path: string }[] {
  return published.map((localization) => ({
    locale: localization.locale,
    path: articlePath(localization.locale, section, localization.slug),
  }));
}
