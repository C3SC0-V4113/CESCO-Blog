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

/** A page number to link, or the gap between two runs of them. */
export type PaginationItem = number | 'ellipsis';

/**
 * Which page numbers a pagination control should offer.
 *
 * The first and last pages are always present: they are the only two a reader
 * can aim for without counting. Around the current page sits a window of
 * neighbours, and anything between those runs collapses into a gap.
 *
 * A gap is only worth drawing when it hides more than one page — standing in
 * for a single number costs the same width and tells the reader less, so the
 * number is printed instead.
 *
 * Pure, and separated from the component for the reason ADR-0031 gives: the
 * awkward cases are the boundaries, and boundaries are cheaper to assert than
 * to click through.
 */
export function paginationItems(page: number, totalPages: number): PaginationItem[] {
  const NEIGHBOURS = 1;

  const wanted = new Set<number>([1, totalPages]);

  for (let offset = -NEIGHBOURS; offset <= NEIGHBOURS; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) wanted.add(candidate);
  }

  // The ends carry an extra page so that page one shows "1 2 3 … 20" rather
  // than "1 2 … 20", where the gap would be hiding a single number anyway.
  if (page <= 2) wanted.add(Math.min(3, totalPages));
  if (page >= totalPages - 1) wanted.add(Math.max(totalPages - 2, 1));

  const pages = [...wanted].sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  pages.forEach((current, index) => {
    const previous = pages[index - 1];

    if (previous !== undefined) {
      // Exactly one page missing: print it rather than mark a gap.
      if (current - previous === 2) items.push(current - 1);
      else if (current - previous > 2) items.push('ellipsis');
    }

    items.push(current);
  });

  return items;
}
