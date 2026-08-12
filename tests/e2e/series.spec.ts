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

test.describe('the series indicator on an article', () => {
  test('says which series a piece belongs to, and where it sits', async ({ page }) => {
    // Before this, a reader could land on part three of a series with nothing
    // telling them the other three existed. The position is what turns a label
    // into an invitation.
    await page.goto('/es/analisis/el-peso-del-silencio');

    const badge = page.getByRole('article').getByRole('link', { name: /El sonido en los juegos/ });

    await expect(badge).toBeVisible();
    await expect(badge).toContainText('1');
    await expect(badge).toContainText('4');
  });

  test('leads straight into the series', async ({ page }) => {
    await page.goto('/es/analisis/el-peso-del-silencio');
    await page
      .getByRole('article')
      .getByRole('link', { name: /El sonido en los juegos/ })
      .click();

    await expect(page).toHaveURL(/\/es\/series\/el-sonido-en-los-juegos$/);
  });

  test('shows nothing for a piece in no series', async ({ page }) => {
    await page.goto('/es/analisis/relleno-04');

    await expect(page.getByRole('article').getByText('Serie')).toHaveCount(0);
  });
});
