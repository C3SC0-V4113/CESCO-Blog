import { expect, test } from '@playwright/test';

/**
 * Tag and game surfaces (ADR-0012).
 *
 * Neither entity is publishable, so neither has a 410 — only a plain 404 for a
 * name that does not exist.
 */

test('lists the posts carrying a tag', async ({ page }) => {
  await page.goto('/es/etiquetas/diseno-sonoro');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diseño sonoro');
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toBeVisible();
});

test('shows a game with its facts and its coverage', async ({ page }) => {
  await page.goto('/es/juegos/un-juego-de-ejemplo');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Un juego de ejemplo');
  await expect(page.getByText('Estudio Ejemplo')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toBeVisible();
});

test('answers 404 rather than 410 for a name that never existed', async ({ page }) => {
  // A tag is a label, not something that was ever published and withdrawn.
  const tag = await page.goto('/es/etiquetas/no-existe');
  const game = await page.goto('/es/juegos/no-existe');

  expect(tag?.status()).toBe(404);
  expect(game?.status()).toBe(404);
});

test('keeps each locale to its own posts on a shared tag', async ({ page }) => {
  // Tags are not localized — the same slug serves both languages — but the
  // posts under it must still be the ones servable in this locale.
  await page.goto('/en/tags/diseno-sonoro');

  await expect(
    page.getByRole('link', { name: 'The weight of silence in exploration games' })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'El peso del silencio en los juegos de exploración' })
  ).toHaveCount(0);
});
