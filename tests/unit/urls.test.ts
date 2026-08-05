import { describe, expect, it } from 'vitest';

import { articlePath, resolveLocalizationUrl } from '@/lib/urls';

/**
 * The decision table of ADR-0010, made executable.
 *
 * The rule that is easiest to get wrong: `410` is decided **exclusively** by
 * `firstPublishedAt`. Whether the content is currently servable — a draft, a
 * withdrawal, a globally archived post — never influences the choice between
 * `404` and `410`. The two questions are "can this be served now" and "was this
 * ever public", and conflating them is what makes a retired URL claim it never
 * existed.
 */

const NEVER_PUBLISHED = { servable: false, firstPublishedAt: null };
const WITHDRAWN = { servable: false, firstPublishedAt: '2026-01-15 10:00:00' };
const LIVE = { servable: true, firstPublishedAt: '2026-01-15 10:00:00' };

describe('resolveLocalizationUrl', () => {
  it('renders a servable localization', () => {
    expect(resolveLocalizationUrl(LIVE, null)).toEqual({ kind: 'render' });
  });

  it('answers 404 for a localization that was never published', () => {
    expect(resolveLocalizationUrl(NEVER_PUBLISHED, null)).toEqual({ kind: 'not-found' });
  });

  it('answers 410 for a localization that was published and withdrawn', () => {
    expect(resolveLocalizationUrl(WITHDRAWN, null)).toEqual({ kind: 'gone' });
  });

  it('answers 410 whatever made it unservable, as long as it was once public', () => {
    // A globally archived post and a withdrawn localization are different
    // states; ADR-0010 deliberately gives them the same answer here, because
    // both were public and indexed.
    expect(resolveLocalizationUrl(WITHDRAWN, null).kind).toBe('gone');
  });

  it('answers 404 for an unknown slug', () => {
    expect(resolveLocalizationUrl(null, null)).toEqual({ kind: 'not-found' });
  });

  it('redirects a retired slug to the current one', () => {
    expect(resolveLocalizationUrl(null, 'nuevo-slug')).toEqual({
      kind: 'redirect',
      slug: 'nuevo-slug',
    });
  });

  it('prefers a live slug over the history table', () => {
    // ADR-0010: resolution checks live slugs first. Retired slugs are reserved
    // permanently, so this should be unreachable — but if it ever happens, the
    // live localization is the truth and a redirect loop is the failure mode
    // worth ruling out.
    expect(resolveLocalizationUrl(LIVE, 'otro-slug')).toEqual({ kind: 'render' });
  });

  it('does not let an archived localization outrank its own history', () => {
    // Still gone, not redirected: this URL is the current slug, and the history
    // entry belongs to some earlier name of the same localization.
    expect(resolveLocalizationUrl(WITHDRAWN, 'otro-slug')).toEqual({ kind: 'gone' });
  });
});

describe('articlePath', () => {
  it('builds the localized section path for each locale', () => {
    expect(articlePath('es', 'analysis', 'el-combate')).toBe('/es/analisis/el-combate');
    expect(articlePath('en', 'analysis', 'the-combat')).toBe('/en/analysis/the-combat');
    expect(articlePath('es', 'opinion', 'una-opinion')).toBe('/es/opinion/una-opinion');
    expect(articlePath('en', 'opinion', 'an-opinion')).toBe('/en/opinion/an-opinion');
  });
});
