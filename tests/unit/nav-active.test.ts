import { describe, expect, it } from 'vitest';

import { isNavItemActive } from '@/lib/navigation';

/**
 * Which navigation item is marked as current.
 *
 * The cases that matter are the two ways this goes wrong: marking nothing on
 * the pages people actually read, and marking the wrong thing because a prefix
 * happened to match.
 */

describe('isNavItemActive', () => {
  it('marks the listing you are on', () => {
    expect(isNavItemActive('/es/analisis', '/es/analisis')).toBe(true);
  });

  it('stays marked inside the section', () => {
    // Without this the bar goes blank on article pages, which is where a reader
    // spends their time and most needs to know where they are.
    expect(isNavItemActive('/es/analisis', '/es/analisis/el-peso-del-silencio')).toBe(true);
    expect(isNavItemActive('/es/series', '/es/series/el-sonido-en-los-juegos')).toBe(true);
  });

  it('does not match a path that merely starts the same', () => {
    // The reason this is not `startsWith`.
    expect(isNavItemActive('/es/blog', '/es/blogosfera')).toBe(false);
    expect(isNavItemActive('/es/opinion', '/es/opiniones-varias')).toBe(false);
  });

  it('treats a trailing slash as the same place', () => {
    expect(isNavItemActive('/es/series', '/es/series/')).toBe(true);
    expect(isNavItemActive('/es/series/', '/es/series')).toBe(true);
  });

  it('does not mark a different section', () => {
    expect(isNavItemActive('/es/analisis', '/es/opinion/contra-la-palabra-inmersion')).toBe(false);
  });

  it('does not mark anything from another locale', () => {
    expect(isNavItemActive('/es/blog', '/en/blog')).toBe(false);
  });
});
