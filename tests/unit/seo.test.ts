import { describe, expect, it } from 'vitest';

import { absolute, buildAlternateLinks, ogAlternateLocales, ogLocale } from '@/lib/seo';

/**
 * ADR-0013's conditional rules, made executable.
 *
 * These matter more than most metadata tests because the failure is silent: a
 * wrong `hreflang` renders fine and tells search engines a translation exists
 * when it does not.
 */

const SITE = 'https://checkpoint.cescovalle.com';

describe('buildAlternateLinks', () => {
  it('declares both locales when both are published', () => {
    const links = buildAlternateLinks(
      [
        { locale: 'es', path: '/es/analisis/silencio' },
        { locale: 'en', path: '/en/analysis/silence' },
      ],
      SITE
    );

    expect(links).toEqual([
      { hreflang: 'es', href: `${SITE}/es/analisis/silencio` },
      { hreflang: 'en', href: `${SITE}/en/analysis/silence` },
      { hreflang: 'x-default', href: `${SITE}/es/analisis/silencio` },
    ]);
  });

  it('omits a locale that is not published', () => {
    // The rule that keeps the cluster trustworthy: an alternate pointing at a
    // 404 is worse than no alternate at all.
    const links = buildAlternateLinks([{ locale: 'es', path: '/es/analisis/silencio' }], SITE);

    expect(links.map((l) => l.hreflang)).toEqual(['es', 'x-default']);
  });

  it('falls back to the published locale when Spanish is absent', () => {
    // x-default must never point at a locale that cannot be served.
    const links = buildAlternateLinks([{ locale: 'en', path: '/en/analysis/silence' }], SITE);

    expect(links).toContainEqual({ hreflang: 'x-default', href: `${SITE}/en/analysis/silence` });
  });

  it('prefers Spanish for x-default whatever the order', () => {
    const links = buildAlternateLinks(
      [
        { locale: 'en', path: '/en/analysis/silence' },
        { locale: 'es', path: '/es/analisis/silencio' },
      ],
      SITE
    );

    expect(links.at(-1)).toEqual({ hreflang: 'x-default', href: `${SITE}/es/analisis/silencio` });
  });

  it('emits nothing when no localization is published', () => {
    expect(buildAlternateLinks([], SITE)).toEqual([]);
  });
});

describe('Open Graph locales', () => {
  it('uses the territory form the protocol requires', () => {
    // Not the site's editorial variant: `es` is region-less by decision
    // (ADR-0027) and invalid in Open Graph, so a territory is added purely as a
    // hint to social platforms.
    expect(ogLocale('es')).toBe('es_ES');
    expect(ogLocale('en')).toBe('en_US');
  });

  it('lists only published counterparts, never the current locale', () => {
    const alternates = ogAlternateLocales(
      [
        { locale: 'es', path: '/es/a' },
        { locale: 'en', path: '/en/a' },
      ],
      'es'
    );

    expect(alternates).toEqual(['en_US']);
  });
});

describe('absolute', () => {
  it('joins without doubling or dropping the separator', () => {
    expect(absolute('https://example.com/', '/es/')).toBe('https://example.com/es/');
    expect(absolute('https://example.com', 'es/')).toBe('https://example.com/es/');
  });
});
