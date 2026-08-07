import { defaultLocale, type Locale } from '@/i18n/locales';

/**
 * The server-side SEO metadata contract (ADR-0013).
 *
 * Pure by construction (ADR-0031), which matters more here than usual: almost
 * every rule below is conditional, and conditionals are where a metadata bug
 * hides. A wrong `hreflang` does not break a page — it quietly tells search
 * engines a translation exists when it does not.
 */

export type AlternateLocalization = {
  locale: Locale;
  /** Absolute path, already localized. */
  path: string;
};

export type AlternateLink = {
  hreflang: string;
  href: string;
};

/**
 * The reciprocal `hreflang` set, plus `x-default`.
 *
 * Only **published** localizations belong here; the caller is responsible for
 * passing nothing else. A locale that is drafted or withdrawn is absent from the
 * set rather than present and pointing at a `404`, which is the failure that
 * makes search engines distrust the whole cluster.
 *
 * `x-default` points at Spanish when Spanish is published, and otherwise at
 * whichever localization exists — never at a locale that cannot be served.
 */
export function buildAlternateLinks(
  published: AlternateLocalization[],
  siteUrl: string
): AlternateLink[] {
  if (published.length === 0) return [];

  const links = published.map((alternate) => ({
    hreflang: alternate.locale,
    href: absolute(siteUrl, alternate.path),
  }));

  const fallback =
    published.find((alternate) => alternate.locale === defaultLocale) ?? published[0];

  return fallback
    ? [...links, { hreflang: 'x-default', href: absolute(siteUrl, fallback.path) }]
    : links;
}

/**
 * Open Graph locale tags, which are **not** the `hreflang` set.
 *
 * The protocol requires `language_TERRITORY`, so the region-less `es` the site
 * publishes in (ADR-0027) is not valid here. No territory is editorially
 * correct, so the widest-recognized formality is used purely as a hint to
 * social platforms.
 *
 * These carry no editorial meaning and never reach a reader. Nothing else in
 * the project should copy a territory from them.
 */
const openGraphLocale: Record<Locale, string> = {
  es: 'es_ES',
  en: 'en_US',
};

export function ogLocale(locale: Locale): string {
  return openGraphLocale[locale];
}

/** Published counterparts other than the current locale, in Open Graph form. */
export function ogAlternateLocales(published: AlternateLocalization[], current: Locale): string[] {
  return published.flatMap((alternate) =>
    alternate.locale === current ? [] : [ogLocale(alternate.locale)]
  );
}

/** Joins the site origin to a path without doubling or dropping the separator. */
export function absolute(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
