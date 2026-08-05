import { expect, test } from '@playwright/test';

/**
 * The article page, end to end: D1 through to HTML.
 *
 * These run against the **built Worker**, not `astro dev` — see the `webServer`
 * note in `playwright.config.ts`. Content comes from the seed script, which the
 * same command runs before the server boots (ADR-0017).
 */

const ES_ARTICLE = '/es/analisis/el-peso-del-silencio';
const EN_ARTICLE = '/en/analysis/the-weight-of-silence';

test('renders a published article from the database', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'El peso del silencio en los juegos de exploración'
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'El silencio como herramienta' })
  ).toBeVisible();
  await expect(page.getByText('escuchar sus propios pasos')).toBeVisible();
});

test('serves each locale its own localization', async ({ page }) => {
  await page.goto(EN_ARTICLE);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The weight of silence in exploration games'
  );
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('never hydrates the article body', async ({ page }) => {
  // The guard for ADR-0019, and the part of it that must never move: whatever
  // the chrome does, the article content is server-rendered HTML.
  //
  // This assertion used to read "the page ships no JavaScript", which held only
  // while the page was the article alone. Global chrome carries one island by
  // design — the theme toggle needs `localStorage` — so the page-wide claim
  // became false the moment the header landed. Narrowing it to the body keeps a
  // guard that can actually stay true, rather than one that gets deleted the
  // first time it is inconvenient.
  await page.goto(ES_ARTICLE);

  await expect(page.locator('.prose astro-island')).toHaveCount(0);
});

test('keeps the article page inside its island budget', async ({ page }) => {
  // DESIGN.md budgets five islands for the entire public site and states that
  // everything else ships no JavaScript. The article page spends exactly one of
  // them today, on the theme toggle.
  //
  // The number is the point: this fails when an island is added here, which
  // forces the addition to be a decision someone made rather than one that
  // arrived with a component.
  await page.goto(ES_ARTICLE);

  await expect(page.locator('astro-island')).toHaveCount(1);
});

test('anchors headings by block id rather than by their text', async ({ page }) => {
  // ADR-0012: rewording a heading must not break a deep link, so the anchor
  // cannot be derived from the heading text.
  await page.goto(ES_ARTICLE);

  const heading = page.getByRole('heading', { level: 2, name: 'El silencio como herramienta' });

  // A block id, which is a UUID — and specifically not a slug of the text
  // above, which is what would silently break every deep link on a copy edit.
  await expect(heading).toHaveAttribute('id', /^[0-9a-f-]{36}$/);
  await expect(heading).not.toHaveAttribute('id', 'el-silencio-como-herramienta');
});

test('answers 404 for a slug that does not exist', async ({ page }) => {
  const response = await page.goto('/es/analisis/no-existe');

  expect(response?.status()).toBe(404);
});

test('does not serve an analysis from the opinion route', async ({ page }) => {
  // The two sections have separate URL spaces (ADR-0007).
  const response = await page.goto('/es/opinion/el-peso-del-silencio');

  expect(response?.status()).toBe(404);
});

test('answers 410 for a withdrawn article, not 404', async ({ page }) => {
  // The distinction ADR-0010 exists for. This address was public and indexed;
  // answering 404 would tell crawlers it never named anything.
  const response = await page.goto('/es/opinion/una-opinion-retirada');

  expect(response?.status()).toBe(410);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Esta publicación ya no está disponible'
  );
});

test('gives a retired address different copy from an unknown one', async ({ page }) => {
  // The same rule as above, from the reader's side rather than the crawler's.
  // Both strings are pinned rather than compared to each other: a comparison
  // would still pass if the two pages drifted into some other pair of wrong
  // messages, as long as they stayed different.
  await page.goto('/es/opinion/una-opinion-retirada');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Esta publicación ya no está disponible'
  );

  await page.goto('/es/analisis/no-existe');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página no existe');
});

test('redirects a retired slug to the current one in a single hop', async ({ page }) => {
  const response = await page.goto('/es/analisis/el-silencio-en-los-videojuegos');

  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/es/analisis/el-peso-del-silencio');

  // ADR-0010 forbids redirect chains, so exactly one hop got us here.
  const hops: string[] = [];
  for (
    let previous = response?.request().redirectedFrom();
    previous;
    previous = previous.redirectedFrom()
  ) {
    hops.push(previous.url());
  }

  expect(hops).toHaveLength(1);
});
