import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * Cache tagging on public responses (ADR-0011).
 *
 * Tags describe what a response depends on, not where it lives, so a purge can
 * be issued from an editorial event without enumerating URLs.
 */

async function cacheTags(page: Page, path: string) {
  const response = await page.goto(path);

  // Trimmed because browsers do not agree on how to hand a header back:
  // Chromium returns `a,b` verbatim while Firefox and WebKit normalise it to
  // `a, b`. The value we emit is identical; only the reading differs.
  return (response?.headers()['cache-tag'] ?? '').split(',').map((tag) => tag.trim());
}

test('tags both localizations of a post with the same aggregate id', async ({ page }) => {
  // The property the whole scheme rests on: publishing one language purges the
  // other's page too, so its hreflang refreshes without anyone listing it.
  const spanish = await cacheTags(page, '/es/analisis/el-peso-del-silencio');
  const english = await cacheTags(page, '/en/analysis/the-weight-of-silence');

  const postTag = spanish.find((tag) => tag.startsWith('post-'));

  expect(postTag).toBeTruthy();
  expect(english).toContain(postTag);
});

test('separates locale and section as their own dependencies', async ({ page }) => {
  const tags = await cacheTags(page, '/es/analisis/el-peso-del-silencio');

  expect(tags).toContain('locale-es');
  expect(tags).toContain('section-analysis');
});

test('tags listings by what they show', async ({ page }) => {
  expect(await cacheTags(page, '/es/analisis')).toEqual(['section-analysis', 'locale-es']);
  expect(await cacheTags(page, '/es/')).toEqual(['locale-es', 'featured']);
  // The full listing shows every section, so a section tag would misdescribe it.
  expect(await cacheTags(page, '/es/blog')).toEqual(['locale-es']);
});

test('keeps a withdrawn URL cacheable only briefly', async ({ page }) => {
  // A long-lived cached 410 survives the republication that should end it and
  // leaves the address dead until someone purges by hand (ADR-0011).
  const response = await page.goto('/es/opinion/una-opinion-retirada');

  expect(response?.status()).toBe(410);
  expect(response?.headers()['cache-control']).toContain('max-age=300');
});
