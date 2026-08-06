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
  // everything else ships no JavaScript. The article page spends four: the
  // language picker, the theme toggle and the section sheet in the chrome, plus
  // the table-of-contents scroll spy.
  //
  // The number is the point, and it has earned its keep twice — once when the
  // scroll spy arrived and once when the sheet did. Each time it turned "an
  // island appeared" into a decision someone had to justify rather than one
  // that slipped in with a component.
  //
  // The sheet counts even though CSS hides it above the `sm` breakpoint:
  // hydration does not care about `display`, which is exactly the sort of cost
  // that hides from a desktop-only look at the page.
  //
  // Four of five is worth noticing. The budget is nearly spent, and the two
  // remaining public islands DESIGN.md names — the copy-link button and search
  // — have to fit inside what is left.
  await page.goto(ES_ARTICLE);

  await expect(page.locator('astro-island')).toHaveCount(4);
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

test('shows the byline, reading time and table of contents', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  // Scoped to the article: the footer also carries the name, in the copyright
  // line, and an unscoped match finds both.
  const article = page.getByRole('article');

  // ADR-0013 wants the date in structured data; DESIGN.md additionally requires
  // it to be visible, because a reader judging whether a games piece is still
  // current needs it as much as a crawler does.
  await expect(article.getByText('Cesco Valle')).toBeVisible();
  await expect(article.getByText('min de lectura')).toBeVisible();

  const toc = page.getByRole('navigation', { name: 'Contenido' });
  await expect(toc.getByRole('link', { name: 'El silencio como herramienta' })).toBeVisible();
});

test('anchors the table of contents at block ids, not heading text', async ({ page }) => {
  // The same ADR-0012 guarantee as the headings themselves, from the other end:
  // if the link and the heading disagree the outline silently stops working.
  await page.goto(ES_ARTICLE);

  const link = page
    .getByRole('navigation', { name: 'Contenido' })
    .getByRole('link', { name: 'El silencio como herramienta' });

  await expect(link).toHaveAttribute('href', /^#[0-9a-f-]{36}$/);
});

test('renders the review-copy disclosure rather than merely storing it', async ({ page }) => {
  // ADR-0012 is explicit that this has to be on the page. A disclosure nobody
  // reads is not a disclosure.
  await page.goto(ES_ARTICLE);

  await expect(page.getByText('Estudio Ejemplo')).toBeVisible();
});

test('shows the analysis facts', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.getByText('Plataforma')).toBeVisible();
  await expect(page.getByText('PC', { exact: true })).toBeVisible();
  await expect(page.getByText('Completado')).toBeVisible();
});
