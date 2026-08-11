import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';
import { articleAlternates, routeAlternates, routePath, routes } from '@/lib/routes';

/**
 * The single place a fixed page's addresses are written down.
 *
 * The value of these is structural rather than anecdotal: they assert that
 * every route has every locale, which is the property that made it safe to stop
 * repeating the pairs by hand in twenty-two pages.
 */

describe('routes', () => {
  it('gives every route an address in every locale', () => {
    // The guard against a half-added page: a route with one locale filled in
    // would send the language picker to `undefined` and the footer to a broken
    // link, in a way no single page test would catch.
    for (const [key, paths] of Object.entries(routes)) {
      for (const locale of locales) {
        expect(paths[locale], `${key} is missing ${locale}`).toMatch(/^\/(es|en)\//);
      }
    }
  });

  it('prefixes each address with its own locale', () => {
    // Catches the copy-paste that leaves a Spanish path under the English key.
    for (const [key, paths] of Object.entries(routes)) {
      for (const locale of locales) {
        expect(paths[locale], `${key} ${locale}`).toMatch(new RegExp(`^/${locale}(/|$)`));
      }
    }
  });

  it('resolves one address', () => {
    expect(routePath('about', 'es')).toBe('/es/acerca-de');
    expect(routePath('about', 'en')).toBe('/en/about');
  });
});

describe('routeAlternates', () => {
  it('offers a fixed page in every locale', () => {
    // Fixed pages ship with the site, so they exist in all of them by
    // definition — unlike an article, which may not be written yet.
    expect(routeAlternates('privacy')).toEqual([
      { locale: 'es', path: '/es/privacidad' },
      { locale: 'en', path: '/en/privacy' },
    ]);
  });
});

describe('articleAlternates', () => {
  it('builds a path per published localization', () => {
    expect(
      articleAlternates('analysis', [
        { locale: 'es', slug: 'el-peso-del-silencio' },
        { locale: 'en', slug: 'the-weight-of-silence' },
      ])
    ).toEqual([
      { locale: 'es', path: '/es/analisis/el-peso-del-silencio' },
      { locale: 'en', path: '/en/analysis/the-weight-of-silence' },
    ]);
  });

  it('offers only what was published, not every locale', () => {
    // The difference that matters against the fixed pages above. Offering a
    // language that has not been published sends a reader — and a crawler — to
    // a 404, which is exactly what ADR-0013 forbids `hreflang` from doing.
    expect(articleAlternates('opinion', [{ locale: 'es', slug: 'solo-espanol' }])).toEqual([
      { locale: 'es', path: '/es/opinion/solo-espanol' },
    ]);
  });

  it('returns nothing for a post with no published localization', () => {
    expect(articleAlternates('analysis', [])).toEqual([]);
  });
});
