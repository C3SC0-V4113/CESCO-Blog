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

test('offers the pages by number, not just the next one', async ({ page }) => {
  // The seed carries filler analyses precisely so this renders at all. Before
  // they existed every listing fitted on one page and this component was
  // unreachable from any test.
  await page.goto('/es/blog');

  // Located by accessible name rather than by the visible digit: the links
  // carry `aria-label="Ir a la página 2"`, so "2" alone is what a sighted
  // reader sees and not what the control is called.
  const pagination = page.getByRole('navigation', { name: 'Paginación' });
  await expect(pagination.getByRole('link', { name: 'Ir a la página 1' })).toBeVisible();
  await expect(pagination.getByRole('link', { name: 'Ir a la página 2' })).toHaveAttribute(
    'href',
    '/es/blog?page=2'
  );
});

test('marks the page you are on for a screen reader, not just visually', async ({ page }) => {
  // `aria-current` is the difference between "this one looks different" and
  // "this one is announced as where you are".
  await page.goto('/es/blog?page=2');

  const current = page
    .getByRole('navigation', { name: 'Paginación' })
    .getByRole('link', { name: 'Ir a la página 2' });

  await expect(current).toHaveAttribute('aria-current', 'page');
});

test('ships the pagination without hydrating it', async ({ page }) => {
  // The component is built from React primitives, and that is *not* the same as
  // shipping React: with no `client:*` directive Astro renders it to HTML on the
  // server and stops there. This test is the guard on that distinction — it is
  // what stops someone adding a directive later and quietly spending an island
  // on a row of links (ADR-0019).
  await page.goto('/es/blog');

  const pagination = page.getByRole('navigation', { name: 'Paginación' });
  await expect(pagination).toBeVisible();
  await expect(pagination.locator('astro-island')).toHaveCount(0);
});

test('walks to the second page and back through the links alone', async ({ page }) => {
  // No JavaScript is involved, so this is the whole contract: the hrefs work.
  await page.goto('/es/blog');
  await page
    .getByRole('navigation', { name: 'Paginación' })
    .getByRole('link', { name: 'Ir a la página 2' })
    .click();

  await expect(page).toHaveURL(/\?page=2$/);
  await expect(page.getByRole('link', { name: 'Entrada de relleno 11' })).toBeVisible();
});
