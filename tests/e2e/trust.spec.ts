import { expect, test } from '@playwright/test';

/**
 * The transparency pages (ADR-0018).
 *
 * ADR-0018 requires them to be reachable from the footer on **every** page,
 * which is the part worth testing: a page nobody can find does not establish
 * anything.
 */

const spanishPages: [string, string][] = [
  ['/es/acerca-de', 'Acerca de'],
  ['/es/contacto', 'Contacto'],
  ['/es/privacidad', 'Privacidad'],
  ['/es/politica-editorial', 'Política editorial'],
  ['/es/divulgaciones', 'Divulgaciones'],
];

const englishPages: [string, string][] = [
  ['/en/about', 'About'],
  ['/en/contact', 'Contact'],
  ['/en/privacy', 'Privacy'],
  ['/en/editorial-policy', 'Editorial policy'],
  ['/en/disclosures', 'Disclosures'],
];

for (const [path, heading] of [...spanishPages, ...englishPages]) {
  test(`serves ${path}`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  });
}

test('reaches every trust page from the footer of an article', async ({ page }) => {
  // The requirement ADR-0018 actually makes: reachable from the footer on every
  // page, not merely existing at a URL someone has to guess.
  await page.goto('/es/analisis/el-peso-del-silencio');
  const footer = page.getByRole('contentinfo');

  for (const [path] of spanishPages) {
    await expect(footer.locator(`a[href="${path}"]`)).toBeVisible();
  }
});

test('pairs each trust page with its counterpart', async ({ page }) => {
  await page.goto('/es/privacidad');

  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
    'href',
    'https://checkpoint.cescovalle.com/en/privacy'
  );
});

test('states plainly that neither the site nor its analytics use cookies', async ({ page }) => {
  // Two separate claims, asserted separately. The first is about the site, the
  // second about the measurement layer — and the second is the one that would
  // quietly stop being true if the analytics decision ever changed.
  await page.goto('/es/privacidad');

  await expect(page.getByText('Este sitio no usa cookies')).toBeVisible();
  await expect(page.getByText('Cloudflare Web Analytics, que no usa cookies')).toBeVisible();
});
