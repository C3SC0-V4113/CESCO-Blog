import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('D1 test harness', () => {
  it('applies Drizzle migrations to the test database', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    ).all<{ name: string }>();

    const tables = results.map((row: { name: string }) => row.name);

    // A representative slice across every migration, so a partially applied
    // migration set fails here rather than inside a feature test.
    expect(tables).toEqual(
      expect.arrayContaining([
        'posts',
        'post_localizations',
        'post_revisions',
        'authors',
        'collections',
        'post_analysis_metadata',
        'post_localization_slug_history',
      ])
    );
  });

  it('exposes the R2 bucket binding', () => {
    expect(env.BUCKET).toBeDefined();
  });
});
