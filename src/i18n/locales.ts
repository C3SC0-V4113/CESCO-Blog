/**
 * Supported locales, mirroring `astro.config.mjs` and the `locale` enum in
 * `src/db/schema.ts`. Kept in its own module so runtime code can import the
 * narrowing helper without pulling in the full string dictionaries.
 */
export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}
