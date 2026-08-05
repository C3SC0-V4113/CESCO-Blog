/**
 * Canonical timestamp format for every text date column in D1.
 *
 * The schema stores dates as TEXT and several columns default to SQLite's
 * `CURRENT_TIMESTAMP`, which produces `YYYY-MM-DD HH:MM:SS` in UTC — a space
 * separator and no timezone marker.
 *
 * Ordering in this project depends on lexicographic comparison of those strings:
 * listings and RSS order by `first_published_at DESC` (ADR-0014). Mixing this
 * format with ISO 8601 in the same column corrupts that ordering **within a
 * single day**: comparison reaches the separator at index 10 only when the date
 * matches, and there the space (0x20) sorts before `T` (0x54), so a 23:00
 * space-formatted row sorts ahead of a 01:00 ISO one.
 *
 * Across different dates the year decides first and ordering survives, which is
 * what makes this easy to miss — it surfaces only among posts published on the
 * same day, and looks like a random glitch rather than a format problem.
 *
 * So application writes use this format too. It is not ISO by preference; it is
 * the format the existing column defaults already produce.
 */

/** `YYYY-MM-DD HH:MM:SS`, UTC — matches SQLite's `CURRENT_TIMESTAMP`. */
export function toDbTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** Parses a stored timestamp back to a `Date`, treating it as UTC. */
export function fromDbTimestamp(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}
