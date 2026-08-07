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
  // everything else ships no JavaScript. The article page spends three of them:
  // two on chrome — the language picker and the theme toggle — and one on the
  // table-of-contents scroll spy.
  //
  // The number is the point, and it has already earned its keep — adding the
  // scroll spy failed this test, which is what turns "an island appeared" into
  // a decision someone made rather than one that arrived with a component.
  await page.goto(ES_ARTICLE);

  await expect(page.locator('astro-island')).toHaveCount(3);
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

test.describe('table of contents', () => {
  test('marks the heading being read', async ({ page }) => {
    // The guard that was missing, and its absence is why the highlight could
    // ship broken: the scroll spy hydrated on `client:visible` while rendering
    // `null`, so its placeholder had no box for the visibility observer to see
    // and the island never woke up. Nothing failed, because nothing asked.
    //
    // Scrolled by pixels rather than with `scrollIntoViewIfNeeded`, which lands
    // headings anywhere in the viewport — including below the upper band the
    // observer's `rootMargin` restricts it to, where not marking is correct.
    await page.goto(ES_ARTICLE);
    await expect(page.locator('[data-toc-link][aria-current]')).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 900));

    // Two, not one: the outline exists twice in the document — the mobile
    // disclosure and the desktop sidebar — and only one is displayed at a time.
    // Both are marked, so the highlight is correct whichever one the viewport
    // is showing.
    await expect(page.locator('[data-toc-link][aria-current]')).toHaveCount(2);
  });

  test('keeps the outline open beside the article on desktop', async ({ page }) => {
    // DESIGN.md: "aside on desktop". No interaction should be needed to read it,
    // and the disclosure control has no business being there.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(ES_ARTICLE);

    const toc = page.getByRole('navigation', { name: 'Contenido' });
    await expect(toc.getByRole('link', { name: 'El silencio como herramienta' })).toBeVisible();
    await expect(page.locator('summary')).toBeHidden();
  });

  test('holds the outline in place while the article scrolls past it', async ({ page }) => {
    // The guard the screenshots earned. Everything else about the sidebar can be
    // true — rendered, visible, labelled, highlighting — while it quietly
    // scrolls away with the article, because `position: sticky` fails silently.
    //
    // It failed twice for different reasons: a start-aligned grid shrank the
    // column to its content, and then the landmark itself was the same height as
    // the panel inside it. A sticky element can only travel inside its
    // containing block, so both left it nowhere to go.
    //
    // Asserted as a position that stops changing, which is what "sticky" means
    // to a reader. Comparing against the scroll delta instead would pass for an
    // element that merely moved slower.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(ES_ARTICLE);

    const panel = page.locator('nav[aria-label="Contenido"] > div').last();
    const top = async () => (await panel.boundingBox())?.y ?? null;

    const before = await top();
    expect(before).not.toBeNull();

    await page.evaluate(() => window.scrollTo(0, 300));

    // Polled rather than slept on: the position settles when the browser has
    // finished scrolling, and a fixed wait would either be slower than that or
    // occasionally shorter.
    await expect.poll(top).toBeLessThan(before!);

    // Pinned near the top of the viewport rather than carried off it.
    const after = await top();
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThanOrEqual(64);
  });

  test.describe('narrow screens', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('starts collapsed and opens on tap', async ({ page }) => {
      // DESIGN.md: "collapsed above content on mobile". Native `<details>`, so
      // this works with no JavaScript at all.
      await page.goto(ES_ARTICLE);

      const link = page
        .getByRole('navigation', { name: 'Contenido' })
        .getByRole('link', { name: 'El silencio como herramienta' });

      await expect(link).toBeHidden();

      await page.locator('summary').click();

      await expect(link).toBeVisible();
    });

    test('stays reachable from the middle of the article', async ({ page }) => {
      // The reason it is sticky. An outline you can only reach by scrolling back
      // to the top is an outline you stop using.
      await page.goto(ES_ARTICLE);
      await page.evaluate(() => window.scrollTo(0, 1200));

      const summary = page.locator('summary');
      const box = await summary.boundingBox();

      expect(box).not.toBeNull();
      expect(box!.y).toBeLessThan(200);
      expect(box!.y + box!.height).toBeGreaterThan(0);
    });
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still opens the outline and follows its links', async ({ page }) => {
    // The collapse is a platform disclosure widget, not an island, so it keeps
    // working when the island never arrives. Only the highlight is lost.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ES_ARTICLE);

    await page.locator('summary').click();

    const link = page
      .getByRole('navigation', { name: 'Contenido' })
      .getByRole('link', { name: 'El silencio como herramienta' });

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^#[0-9a-f-]{36}$/);
  });
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

test('names the game the analysis is about', async ({ page }) => {
  // The panel holds the structured facts a reader weighs the piece by, and
  // which game it covers is the first of them. It lives on `posts`, not on the
  // analysis metadata row — an opinion piece can name a game too — so it is
  // passed to the panel separately rather than folded into the metadata.
  await page.goto(ES_ARTICLE);

  const article = page.getByRole('article');
  await expect(article.getByText('Juego', { exact: true })).toBeVisible();
  await expect(article.getByRole('link', { name: 'Un juego de ejemplo' })).toHaveAttribute(
    'href',
    '/es/juegos/un-juego-de-ejemplo'
  );
});

test('sends the game link to a page that exists', async ({ page }) => {
  // The project links only live routes, and this one became live in the same
  // change that added the link. Following it is the cheapest proof of that.
  await page.goto(ES_ARTICLE);
  await page.getByRole('article').getByRole('link', { name: 'Un juego de ejemplo' }).click();

  await expect(page).toHaveURL(/\/es\/juegos\/un-juego-de-ejemplo$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Un juego de ejemplo');
});
