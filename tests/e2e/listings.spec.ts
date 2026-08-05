import { expect, test } from '@playwright/test';

/**
 * Listing surfaces (ADR-0014, ADR-0016).
 *
 * Content comes from the seed: one published analysis in each locale, plus a
 * withdrawn opinion that must not appear anywhere.
 */

test('lists the published post on the home page', async ({ page }) => {
  await page.goto('/es/');

  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toBeVisible();
});

test('does not list a withdrawn post', async ({ page }) => {
  // It answers 410 at its own URL, and it must not be offered from a listing.
  await page.goto('/es/blog');

  await expect(page.getByRole('link', { name: 'Una opinión retirada' })).toHaveCount(0);
});

test('filters a section listing to its own section', async ({ page }) => {
  await page.goto('/es/analisis');
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toBeVisible();

  await page.goto('/es/opinion');
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toHaveCount(0);
});

test('says so when a listing is empty rather than showing a blank page', async ({ page }) => {
  // Locales publish independently (ADR-0008), so an empty section is a normal
  // early state rather than a failure.
  await page.goto('/es/opinion');

  await expect(page.getByText('Todavía no hay publicaciones en este idioma.')).toBeVisible();
});

test('keeps each locale to its own listing', async ({ page }) => {
  await page.goto('/en/');

  await expect(
    page.getByRole('link', { name: 'The weight of silence in exploration games' })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toHaveCount(0);
});

test('survives a nonsense page parameter', async ({ page }) => {
  // The value comes from the address bar, so every branch is reachable.
  const response = await page.goto('/es/blog?page=abc');

  expect(response?.status()).toBe(200);
});
