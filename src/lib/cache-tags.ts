import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

/**
 * Cache tagging for public responses (ADR-0011).
 *
 * Responses are tagged by **what they depend on**, not by their URL. A URL-keyed
 * scheme forces the publisher to enumerate every address a change touches, and
 * the one it forgets stays stale.
 *
 * The load-bearing choice is tagging a post by its **locale-neutral aggregate
 * id**, not by the localization. Both the Spanish and English detail pages carry
 * the same `post-{id}`, so publishing either locale purges both — and the
 * `hreflang` on the already-published side refreshes without anyone realising it
 * had to.
 *
 * Pure (ADR-0031). Purging is the other half of this ADR and belongs with the
 * publishing flow that triggers it; a purge module with no caller would be dead
 * code guessing at an API it never exercises.
 */

/**
 * Short, not long, for `301` and `410` (ADR-0011).
 *
 * A long-lived cached `410` outlives the republication that should end it and
 * leaves the URL dead until someone purges by hand. Five minutes still absorbs
 * a crawl burst without turning a mistake into a lasting one.
 */
export const ERROR_RESPONSE_MAX_AGE = 300;

export function postDetailTags(postId: string, locale: Locale, section: PostSection): string[] {
  return [`post-${postId}`, `locale-${locale}`, `section-${section}`];
}

export function sectionListingTags(locale: Locale, section: PostSection): string[] {
  return [`section-${section}`, `locale-${locale}`];
}

export function homeTags(locale: Locale): string[] {
  return [`locale-${locale}`, 'featured'];
}

/** The full listing depends on every section, so it carries only the locale. */
export function fullListingTags(locale: Locale): string[] {
  return [`locale-${locale}`];
}

/**
 * Renders the header value.
 *
 * Cloudflare reads `Cache-Tag` as a comma-separated list. Duplicates are
 * dropped so a caller composing tag sets cannot accidentally spend its
 * per-response tag budget twice on the same dependency.
 */
export function cacheTagHeader(tags: string[]): string {
  return [...new Set(tags)].join(',');
}
