import { describe, expect, it } from 'vitest';

import { fromDbTimestamp, toDbTimestamp } from '@/lib/timestamps';

describe('database timestamps', () => {
  it('matches the format SQLite CURRENT_TIMESTAMP produces', () => {
    expect(toDbTimestamp(new Date('2026-08-04T20:28:43.512Z'))).toBe('2026-08-04 20:28:43');
  });

  it('round-trips through parsing as UTC', () => {
    const original = new Date('2026-01-15T10:00:00.000Z');

    expect(fromDbTimestamp(toDbTimestamp(original)).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('sorts chronologically as plain text', () => {
    // Listings and RSS order by `first_published_at DESC` on a TEXT column
    // (ADR-0014), so lexicographic order has to match chronological order.
    const stamps = [
      toDbTimestamp(new Date('2026-07-01T08:00:00Z')),
      toDbTimestamp(new Date('2025-06-01T08:00:00Z')),
      toDbTimestamp(new Date('2026-07-01T07:59:59Z')),
    ];

    expect([...stamps].sort()).toEqual([
      '2025-06-01 08:00:00',
      '2026-07-01 07:59:59',
      '2026-07-01 08:00:00',
    ]);
  });

  it('sorts wrongly against ISO strings within the same day, which is why the format is fixed', () => {
    // Same calendar date, so comparison reaches the separator at index 10.
    const laterCanonical = toDbTimestamp(new Date('2026-07-01T23:00:00Z'));
    const earlierIso = new Date('2026-07-01T01:00:00Z').toISOString();

    // The space (0x20) sorts before 'T' (0x54), so the 23:00 row sorts ahead of
    // the 01:00 one — backwards. Across different dates the year decides first
    // and ordering survives, which is exactly what makes this corruption easy
    // to miss: it only shows up among posts published on the same day.
    expect([earlierIso, laterCanonical].sort()[0]).toBe(laterCanonical);
  });
});
