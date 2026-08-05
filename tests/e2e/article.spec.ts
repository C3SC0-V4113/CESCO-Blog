import { expect, test } from '@playwright/test';

/**
 * The article page, end to end: D1 through to HTML.
 *
 * Content comes from the seed script, which `global-setup.ts` runs before the
 * server starts (ADR-0017).
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

test('hydrates nothing', async ({ page }) => {
  // The guard for ADR-0019: the article body is the least interactive surface
  // on the site and must cost the reader no JavaScript.
  //
  // `astro-island` is the element Astro emits for every `client:*` directive,
  // so zero of them is exactly "no component on this page hydrates", and it
  // reads the same in dev and in a production build.
  //
  // Counting script requests was tried and removed. Under `astro dev` Vite
  // serves component styles and CSS as JS modules — `/src/…/prose.astro` shows
  // up as a script — and a genuinely hydrated island would appear under the
  // same `/src/` prefix. The two are indistinguishable there, so the check
  // could only be made to pass by excluding what it was meant to catch.
  // Counting bytes of client JS needs the suite pointed at a production build.
  await page.goto(ES_ARTICLE);

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
