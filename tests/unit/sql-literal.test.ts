import { describe, expect, it } from 'vitest';

import { sqlLiteral } from '../../scripts/sql.ts';

/**
 * `wrangler d1 execute` takes a SQL file and has no parameter binding, so the
 * seed script has to inline its values. That makes escaping the one place a bug
 * turns editorial prose into a syntax error — or worse, into injected SQL.
 */

describe('sqlLiteral', () => {
  it('renders null and undefined as NULL', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(undefined)).toBe('NULL');
  });

  it('quotes strings', () => {
    expect(sqlLiteral('hola')).toBe("'hola'");
  });

  it('doubles single quotes', () => {
    // The apostrophe is unavoidable in editorial copy, in both languages.
    expect(sqlLiteral("l'important")).toBe("'l''important'");
  });

  it('leaves backslashes alone', () => {
    // SQLite has no backslash escape: doubling one would corrupt a code block.
    expect(sqlLiteral('C:\\path')).toBe("'C:\\path'");
  });

  it('survives a quote-heavy JSON payload', () => {
    const json = JSON.stringify({ text: 'it\'s "quoted"' });

    expect(sqlLiteral(json)).toBe('\'{"text":"it\'\'s \\"quoted\\""}\'');
  });

  it('renders numbers bare', () => {
    expect(sqlLiteral(7)).toBe('7');
    expect(sqlLiteral(0)).toBe('0');
    expect(sqlLiteral(-1.5)).toBe('-1.5');
  });

  it('renders booleans as SQLite integers', () => {
    expect(sqlLiteral(true)).toBe('1');
    expect(sqlLiteral(false)).toBe('0');
  });

  it('refuses a non-finite number rather than emitting invalid SQL', () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow();
    expect(() => sqlLiteral(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('refuses a value it cannot render', () => {
    // Failing loudly beats emitting `[object Object]` into a seed file.
    expect(() => sqlLiteral({ a: 1 })).toThrow();
  });

  it('closes an injection attempt instead of ending the statement', () => {
    const hostile = "'); DROP TABLE posts; --";

    expect(sqlLiteral(hostile)).toBe("'''); DROP TABLE posts; --'");
  });
});
