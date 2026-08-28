import { describe, expect, it } from 'vitest';

import { publishE2eFixture, publishE2eFixtures } from '../../scripts/publish-e2e-fixtures';

describe('publish E2E fixtures', () => {
  it('assigns a unique aggregate to every browser project and retry', () => {
    const fixtures = publishE2eFixtures(2);
    expect(fixtures).toHaveLength(9);
    expect(new Set(fixtures.map(({ postId }) => postId))).toHaveLength(9);
    expect(new Set(fixtures.map(({ slug }) => slug))).toHaveLength(9);
    expect(publishE2eFixture('webkit', 2).slug).toBe('publish-e2e-webkit-retry-2');
  });

  it('rejects an unsupported browser project or retry', () => {
    expect(() => publishE2eFixture('unknown', 0)).toThrow();
    expect(() => publishE2eFixture('chromium', 3)).toThrow();
  });
});
