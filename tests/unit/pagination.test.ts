import { describe, expect, it } from 'vitest';

import { pageCount, paginationItems, POSTS_PER_PAGE, readPageWindow } from '@/lib/pagination';

/**
 * The `page` parameter arrives from the URL, so every branch here is reachable
 * by anyone typing into the address bar.
 */

describe('readPageWindow', () => {
  it('defaults to the first page', () => {
    expect(readPageWindow(null)).toEqual({ page: 1, offset: 0, limit: POSTS_PER_PAGE });
  });

  it('offsets by whole pages', () => {
    expect(readPageWindow('3').offset).toBe(POSTS_PER_PAGE * 2);
  });

  it.each(['0', '-2', 'abc', '1.5', '', ' '])(
    'falls back to page one for %o rather than failing',
    (input) => {
      // A bad page parameter is someone following a broken link, not a reason
      // to answer 500.
      expect(readPageWindow(input).page).toBe(1);
    }
  );
});

describe('pageCount', () => {
  it('rounds partial pages up', () => {
    expect(pageCount(POSTS_PER_PAGE + 1)).toBe(2);
  });

  it('reports one page when there is nothing to show', () => {
    // An empty listing still renders "1 / 1" rather than "1 / 0".
    expect(pageCount(0)).toBe(1);
  });
});

describe('paginationItems', () => {
  it('lists every page while they still fit', () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first and last page reachable from the middle', () => {
    // Those two are the only pages a reader can aim for without counting, so
    // they never disappear behind a gap.
    expect(paginationItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });

  it('opens out at the start instead of stranding page two behind a gap', () => {
    expect(paginationItems(1, 20)).toEqual([1, 2, 3, 'ellipsis', 20]);
  });

  it('opens out at the end the same way', () => {
    expect(paginationItems(20, 20)).toEqual([1, 'ellipsis', 18, 19, 20]);
  });

  it('never hides exactly one page behind an ellipsis', () => {
    // A gap marker standing in for a single number costs the same width and
    // says less. Swept across every shape rather than spot-checked, because the
    // boundary between "gap" and "just print it" is where this goes wrong.
    for (let total = 1; total <= 25; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const items = paginationItems(page, total);

        items.forEach((item, index) => {
          if (item !== 'ellipsis') return;

          const before = items[index - 1];
          const after = items[index + 1];

          expect(typeof before).toBe('number');
          expect(typeof after).toBe('number');
          expect((after as number) - (before as number)).toBeGreaterThan(2);
        });
      }
    }
  });

  it('always offers the page you are on', () => {
    for (let total = 1; total <= 25; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        expect(paginationItems(page, total)).toContain(page);
      }
    }
  });
});
