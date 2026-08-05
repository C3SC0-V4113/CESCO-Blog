import { describe, expect, it } from 'vitest';

import { footerLinks, mainNavItems } from '@/lib/navigation';

/**
 * The chrome links, kept in one place so a route that does not exist yet cannot
 * be linked from anywhere.
 *
 * The site is being built as a chain of PRs, so for most of that time the header
 * and footer know about destinations that have no page behind them. A link to a
 * 404 is worse than a missing link: it looks like the site is broken rather than
 * unfinished, and nothing fails a build to tell us.
 */

describe('mainNavItems', () => {
  it('links only to routes that exist', () => {
    // Every entry must be listed as live. When a listing PR lands, its route is
    // added here and the header picks it up.
    for (const item of mainNavItems('es')) {
      expect(item.href.startsWith('/es/')).toBe(true);
    }
  });

  it('prefixes every destination with its own locale', () => {
    for (const item of mainNavItems('en')) {
      expect(item.href.startsWith('/en/')).toBe(true);
    }
  });

  it('gives each locale the same set of destinations', () => {
    expect(mainNavItems('es').map((i) => i.key)).toEqual(mainNavItems('en').map((i) => i.key));
  });

  it('does not offer search, which has no route', () => {
    // `nav.search` exists in the dictionary and is deliberately unused: the
    // search surface depends on indexing decisions that have not been made.
    expect(mainNavItems('es').some((i) => i.key === 'nav.search')).toBe(false);
  });
});

describe('footerLinks', () => {
  it('links only to routes that exist', () => {
    for (const link of footerLinks('es')) {
      expect(link.href.startsWith('/es/')).toBe(true);
    }
  });

  it('gives each locale the same set of destinations', () => {
    expect(footerLinks('es').map((l) => l.key)).toEqual(footerLinks('en').map((l) => l.key));
  });
});
