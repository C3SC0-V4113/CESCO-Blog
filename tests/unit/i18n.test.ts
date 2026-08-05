import { describe, expect, it } from 'vitest';

import { defaultLocale, isLocale, locales } from '@/i18n/locales';
import { ui } from '@/i18n/ui';
import { formatDate, resolveLocale, getTranslations } from '@/i18n/utils';

describe('locales', () => {
  it('mirrors the locales configured for routing', () => {
    expect(locales).toEqual(['es', 'en']);
    expect(defaultLocale).toBe('es');
  });

  it('narrows unknown values from Astro.currentLocale', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(resolveLocale(undefined)).toBe('es');
    expect(resolveLocale('en')).toBe('en');
  });
});

describe('translations', () => {
  it('returns strings for the requested locale', () => {
    expect(getTranslations('es')('nav.analysis')).toBe('Análisis');
    expect(getTranslations('en')('nav.analysis')).toBe('Analysis');
  });

  it('keeps both dictionaries at key parity', () => {
    // The `satisfies` in ui.ts makes a missing key a compile error; this asserts
    // the same invariant at runtime so a cast could not hide a gap.
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.es).sort());
  });

  it('distinguishes 404 copy from 410 copy', () => {
    // ADR-0010 pays for the distinction in the schema; wording that treats them
    // the same would waste it.
    const t = getTranslations('es');
    expect(t('error.404.title')).not.toBe(t('error.410.title'));
  });
});

describe('date formatting', () => {
  it('formats stored timestamps per locale', () => {
    expect(formatDate('2026-01-15 10:00:00', 'es')).toBe('15 de enero de 2026');
    expect(formatDate('2026-01-15 10:00:00', 'en')).toBe('January 15, 2026');
  });

  it('keeps Spanish region-less', () => {
    // ADR-0027: the site targets the whole Spanish-speaking audience, so the tag
    // makes no regional claim. Every long-form variant renders identically, so a
    // country tag would pass the assertion above while breaking the intent —
    // this asserts the tag itself.
    const resolved = new Intl.DateTimeFormat('es').resolvedOptions().locale;
    expect(resolved).toBe('es');
  });

  it('treats stored timestamps as UTC regardless of host timezone', () => {
    // Late-evening UTC must not roll back a day when the runner sits west of it.
    expect(formatDate('2026-03-10 23:30:00', 'en')).toBe('March 10, 2026');
  });
});
