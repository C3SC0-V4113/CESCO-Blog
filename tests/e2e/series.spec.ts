import { expect, test } from '@playwright/test';

/**
 * Series pages (ADR-0012), and the proof that ADR-0010's lifecycle is
 * entity-agnostic rather than a rule posts got and collections did not.
 */

test('renders a published series with its members in order', async ({ page }) => {
  await page.goto('/es/series/el-sonido-en-los-juegos');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El sonido en los juegos');
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toBeVisible();
});

test('orders members by position, not by publication date', async ({ page }) => {
  // The guard the one-member seed could not carry. `collection_posts.position`
  // is what decides reading order, and the members are attached deliberately
  // out of date order — so a listing that sorted by `first_published_at`
  // instead would produce a visibly different sequence here rather than in
  // production.
  await page.goto('/es/series/el-sonido-en-los-juegos');

  const titles = await page.getByRole('article').getByRole('heading').allInnerTexts();

  expect(titles.length).toBeGreaterThan(1);
  expect(titles[0]).toContain('El peso del silencio');
});

test('publishes the series in both languages', async ({ page }) => {
  // A collection follows the same bilingual rules as everything else, which a
  // Spanish-only seed could not show.
  await page.goto('/en/series/sound-in-games');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sound in games');
});

test('answers 404 for a series that does not exist', async ({ page }) => {
  const response = await page.goto('/es/series/no-existe');

  expect(response?.status()).toBe(404);
});

test('links series from the header now that the route exists', async ({ page }) => {
  await page.goto('/es/');

  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Series', exact: true })
  ).toBeVisible();
});
