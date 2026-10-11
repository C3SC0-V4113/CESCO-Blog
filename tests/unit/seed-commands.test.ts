import { describe, expect, it } from 'vitest';

import { d1SeedArgs, persistToArgs, r2SeedArgs } from '../../scripts/seed-commands';

describe('local seed command arguments', () => {
  it('leaves Wrangler persistence at its default when no directory is configured', () => {
    expect(persistToArgs('')).toEqual([]);
    expect(d1SeedArgs('')).toEqual([
      'd1',
      'execute',
      'cesco-blog',
      '--local',
      '--file=.wrangler/seed.sql',
    ]);
    expect(r2SeedArgs('media/example.png', 'image.png', '')).toEqual([
      'r2',
      'object',
      'put',
      'cesco-blog-media/media/example.png',
      '--file=image.png',
      '--content-type=image/png',
      '--local',
    ]);
  });

  it('points D1 and R2 at the configured disposable persistence directory', () => {
    expect(d1SeedArgs('.wrangler/e2e')).toContain('--persist-to');
    expect(d1SeedArgs('.wrangler/e2e').at(-1)).toBe('.wrangler/e2e');
    expect(r2SeedArgs('media/example.png', 'image.png', '.wrangler/e2e').slice(-2)).toEqual([
      '--persist-to',
      '.wrangler/e2e',
    ]);
  });
});
