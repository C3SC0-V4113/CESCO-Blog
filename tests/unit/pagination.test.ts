import { describe, expect, it } from 'vitest';

import { pageCount, POSTS_PER_PAGE, readPageWindow } from '@/lib/pagination';

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
