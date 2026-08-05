/**
 * SQL literal rendering for the seed script (ADR-0017).
 *
 * `wrangler d1 execute` accepts a `--file` of statements but offers no
 * parameter binding, so values Drizzle would normally bind have to be inlined.
 * This module is that inlining, kept separate and tested because it is the one
 * place where a quote in editorial copy becomes a syntax error.
 *
 * SQLite escapes a single quote by doubling it and gives backslashes no special
 * meaning. Doubling backslashes here would corrupt every Windows path and every
 * regex inside a code block.
 */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot render non-finite number as SQL: ${String(value)}`);
    }
    return String(value);
  }

  // Drizzle already maps boolean-mode columns to 0/1; this covers plain values.
  if (typeof value === 'boolean') return value ? '1' : '0';

  if (typeof value === 'bigint') return value.toString();

  throw new TypeError(`Cannot render ${typeof value} as a SQL literal`);
}
