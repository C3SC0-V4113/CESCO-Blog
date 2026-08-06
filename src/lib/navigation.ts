import { sectionPath } from '@/lib/urls';

import type { Locale } from '@/i18n/locales';
import type { UiKey } from '@/i18n/ui';

/**
 * Destinations the chrome is allowed to link to.
 *
 * The site is being built as a chain of PRs, so the dictionary knows about
 * series, search and five trust pages long before any of them has a route.
 * Linking to them early produces a header full of `404`s, which reads as a
 * broken site rather than an unfinished one — and nothing fails a build to say
 * so.
 *
 * So the lists below hold only what is live. Each PR that adds a surface adds
 * its entry here, and the header and footer pick it up without being touched.
 * That is also why this is a module rather than a literal inside each
 * component: two copies of "what exists" drift the first time one is updated.
 *
 * Pure by construction (ADR-0031): no I/O, so the rule is unit-testable.
 */

export type NavItem = {
  /** Dictionary key, so the label stays typed against ADR-0027. */
  key: UiKey;
  href: string;
};

/**
 * Primary navigation.
 *
 * Series and search are still absent: the series index arrives with the
 * taxonomy work, and search has no route at all because it depends on indexing
 * decisions nobody has made. Home is omitted because the wordmark already
 * points there and a second link to the same place is noise.
 */
export function mainNavItems(locale: Locale): NavItem[] {
  return [
    { key: 'nav.blog', href: `/${locale}/blog` },
    { key: 'nav.analysis', href: sectionPath(locale, 'analysis') },
    { key: 'nav.opinion', href: sectionPath(locale, 'opinion') },
    { key: 'nav.series', href: `/${locale}/series` },
  ];
}

/**
 * Footer links: the five transparency pages of ADR-0018.
 *
 * ADR-0018 requires these to be reachable from the footer on **every** page,
 * which is what makes the footer worth having at all.
 *
 * The per-language RSS feed is not here yet — the route exists, but a feed link
 * belongs beside the other syndication affordances rather than in this list.
 */
const trustPaths: Record<Locale, Record<string, string>> = {
  es: {
    'footer.about': '/es/acerca-de',
    'footer.contact': '/es/contacto',
    'footer.privacy': '/es/privacidad',
    'footer.editorialPolicy': '/es/politica-editorial',
    'footer.disclosures': '/es/divulgaciones',
  },
  en: {
    'footer.about': '/en/about',
    'footer.contact': '/en/contact',
    'footer.privacy': '/en/privacy',
    'footer.editorialPolicy': '/en/editorial-policy',
    'footer.disclosures': '/en/disclosures',
  },
};

export function footerLinks(locale: Locale): NavItem[] {
  return Object.entries(trustPaths[locale]).map(([key, href]) => ({
    key: key as UiKey,
    href,
  }));
}
