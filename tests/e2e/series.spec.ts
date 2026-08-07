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
