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

test('ships no JavaScript at all', async ({ page }) => {
  // The guard for ADR-0019. Because this runs against the built Worker, the
  // claim can be the literal one — no script was emitted — rather than the
  // proxy "no island hydrates" that a dev server forces. Under `astro dev` Vite
  // serves its HMR client and component styles as JS modules, so a page with
  // zero client code and one with a hydrated island look alike.
  const scriptRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scriptRequests.push(request.url());
  });

  const response = await page.goto(ES_ARTICLE);
  const html = (await response?.text()) ?? '';

  // Three angles on the same property: what the server sent, what the browser
  // asked for afterwards, and whether Astro marked anything for hydration.
  expect(html).not.toContain('<script');
  expect(scriptRequests).toEqual([]);
  await expect(page.locator('astro-island')).toHaveCount(0);
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
