import type { Locale } from '@/i18n/locales';
import type { UiKey } from '@/i18n/ui';

/**
 * Destinations the chrome is allowed to link to.
 *
 * The site is being built as a chain of PRs, so the dictionary knows about
 * sections, series, search and five trust pages long before any of them has a
 * route. Linking to them early produces a header full of `404`s, which reads as
 * a broken site rather than an unfinished one — and nothing fails a build to
 * say so.
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
 * Empty of sections today: `/blog`, the per-section listings and the series
 * index all arrive with the listing work, and `nav.search` has no route at all
 * because search depends on indexing decisions nobody has made. Home is the
 * only destination that exists, and the wordmark already points there, so the
 * bar renders nothing rather than one redundant link.
 */
export function mainNavItems(_locale: Locale): NavItem[] {
  return [];
}

/**
 * Footer links.
 *
 * Also empty today. The five trust pages of ADR-0018 and the per-language RSS
 * feed of ADR-0014 are the footer's whole purpose, and neither exists yet, so
 * the footer carries attribution alone until they land.
 */
export function footerLinks(_locale: Locale): NavItem[] {
  return [];
}
