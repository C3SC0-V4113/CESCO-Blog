/**
 * Listing pagination arithmetic (ADR-0031: pure, so it is unit-testable).
 *
 * Kept out of the pages because every listing repeats it, and an off-by-one in
 * an offset is the kind of bug that shows up as a quietly missing post rather
 * than as an error.
 */

export const POSTS_PER_PAGE = 10;

export type PageWindow = {
  page: number;
  offset: number;
  limit: number;
};

/**
 * Reads `?page=` defensively.
 *
 * The value arrives from the URL, so it can be anything. Everything that is not
 * a whole number above zero becomes page one rather than an error: a bad page
 * parameter is a reader following a broken link, not something worth a `500`.
 */
export function readPageWindow(param: string | null): PageWindow {
  const parsed = Number(param);
  const page = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  return { page, offset: (page - 1) * POSTS_PER_PAGE, limit: POSTS_PER_PAGE };
}

/** Total pages for a result count. Always at least one, so an empty listing still renders page 1 of 1. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
}
