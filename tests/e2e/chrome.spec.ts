import { expect, test } from '@playwright/test';

/**
 * Global chrome: the header, the footer, and the one island the public site
 * ships (ADR-0021, ADR-0022, DESIGN.md).
 *
 * `colorScheme` is pinned so the starting theme is a fact rather than whatever
 * the runner happens to prefer.
 */

test.use({ colorScheme: 'light' });

const ES_ARTICLE = '/es/analisis/el-peso-del-silencio';

test('carries the chrome on every page', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cesco Blog' })).toBeVisible();
});

test('offers the languages behind a control, not among the destinations', async ({ page }) => {
  // The picker is something you change, not somewhere you go. It reads as a
  // button rather than a nav link, and the alternatives appear on activation.
  await page.goto(ES_ARTICLE);

  const trigger = page.getByRole('button', { name: 'Cambiar idioma' });
  await expect(trigger).toBeVisible();

  // Retried as a unit because the picker hydrates on `client:idle`: a click
  // that lands before hydration does nothing, and WebKit reaches idle later
  // than the others. Waiting on a hydration marker instead would test Astro's
  // implementation detail rather than the behaviour a reader gets.
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'English' })).toBeVisible({ timeout: 1_000 });
  }).toPass();

  await expect(page.getByRole('menuitem', { name: 'English' })).toHaveAttribute('href', '/en/');
});

test('offers a skip link before anything else', async ({ page }) => {
  // Visually hidden until focused, so keyboard users reach the content without
  // walking the header first.
  //
  // Asserted structurally rather than by pressing Tab: WebKit does not move
  // focus to links on Tab unless the user has turned that on, so a keyboard
  // simulation here would be testing Safari's preferences instead of our markup.
  // Being the document's first link is the property that matters anyway.
  await page.goto(ES_ARTICLE);

  const skipLink = page.locator('a').first();
  await expect(skipLink).toHaveAttribute('href', '#main');
  await expect(skipLink).toHaveText('Saltar al contenido');

  await skipLink.focus();
  await expect(skipLink).toBeFocused();
});

test('does not link to a route that does not exist yet', async ({ page }) => {
  // The header renders only live destinations. Sections, the series index and
  // search have dictionary entries but no pages, and linking them early fills
  // the header with 404s.
  await page.goto(ES_ARTICLE);

  // `exact` matters: accessible names match as substrings by default, and
  // "Blog" is inside the "Cesco Blog" wordmark.
  for (const name of ['Análisis', 'Opiniones', 'Series', 'Buscar', 'Blog']) {
    await expect(page.getByRole('banner').getByRole('link', { name, exact: true })).toHaveCount(0);
  }
});

test('applies the stored theme before paint and remembers the choice', async ({ page }) => {
  await page.goto(ES_ARTICLE);
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  // The real assertion is what survives a reload. A theme applied during
  // hydration rather than by the blocking head script would paint light first
  // and correct itself — the flash the script exists to prevent.
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
