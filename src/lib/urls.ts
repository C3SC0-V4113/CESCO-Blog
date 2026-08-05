import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

/**
 * The public URL lifecycle (ADR-0010).
 *
 * Four answers, and the whole point of the ADR is that a retired URL must not
 * be confused with one that never existed — crawlers treat those differently,
 * and collapsing them throws away the distinction permanently.
 */
export type UrlResolution =
  | { kind: 'render' }
  | { kind: 'redirect'; slug: string }
  | { kind: 'gone' }
  | { kind: 'not-found' };

/**
 * Deliberately two independent fields, because ADR-0010 makes them answer two
 * different questions and mixing them is the mistake it exists to prevent.
 */
export type LocalizationUrlState = {
  /**
   * Whether this can be served right now — published, not withdrawn, not
   * globally archived. Says nothing about whether it was ever public, and so
   * **never** influences the choice between `404` and `410`.
   */
  servable: boolean;
  /**
   * Set on first publication, never cleared and never overwritten. The sole
   * determinant of `410`. A null timestamp here means the URL never existed
   * publicly, whatever its current status says.
   */
  firstPublishedAt: string | null;
};

/**
 * Decides the response for a localized URL.
 *
 * Entity-agnostic on purpose: ADR-0010 applies the same rule to every
 * publishable localized entity, not only to posts. A collection localization
 * carries `first_published_at` under the same contract, so a withdrawn series
 * URL answers `410` exactly like a withdrawn article. Collections pass `null`
 * for the retired slug because they keep no slug history — their slugs are
 * treated as immutable after publication until a history table exists, since a
 * mutable slug with no history is the one combination that silently breaks
 * links.
 *
 * Live slugs win over the history table (ADR-0010). Retired slugs are reserved
 * permanently, so a slug cannot legitimately be both — but resolving in this
 * order means that if the invariant is ever violated, the answer is the live
 * content rather than a redirect that could point at itself.
 */
export function resolveLocalizationUrl(
  live: LocalizationUrlState | null,
  retiredSlugTarget: string | null
): UrlResolution {
  if (live) {
    if (live.servable) return { kind: 'render' };

    return live.firstPublishedAt !== null ? { kind: 'gone' } : { kind: 'not-found' };
  }

  if (retiredSlugTarget !== null) return { kind: 'redirect', slug: retiredSlugTarget };

  return { kind: 'not-found' };
}

/**
 * The section segment differs per locale, which is why the path cannot be built
 * by interpolation at the call site.
 */
const sectionSegment: Record<Locale, Record<PostSection, string>> = {
  es: { analysis: 'analisis', opinion: 'opinion' },
  en: { analysis: 'analysis', opinion: 'opinion' },
};

/** Canonical public path for an article. */
export function articlePath(locale: Locale, section: PostSection, slug: string): string {
  return `/${locale}/${sectionSegment[locale][section]}/${slug}`;
}
