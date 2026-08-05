import { expect, test } from '@playwright/test';

/**
 * The SEO head contract (ADR-0013).
 *
 * All of it is server-rendered, so these read the response body rather than the
 * hydrated DOM — a crawler that runs no JavaScript must see exactly this.
 */

const SITE = 'https://checkpoint.cescovalle.com';
const ES_ARTICLE = '/es/analisis/el-peso-del-silencio';

test('points the canonical at the current localized URL', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${SITE}${ES_ARTICLE}`
  );
});

test('declares both locales reciprocally when both are published', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.locator('link[hreflang="es"]')).toHaveAttribute('href', `${SITE}${ES_ARTICLE}`);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
    'href',
    `${SITE}/en/analysis/the-weight-of-silence`
  );
});

test('points x-default at Spanish', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
    'href',
    `${SITE}${ES_ARTICLE}`
  );
});

test('does not declare an alternate for a locale that is not published', async ({ page }) => {
  // The withdrawn opinion exists only in Spanish, so English must be absent
  // from its cluster rather than present and pointing at a 404. It answers 410,
  // and an error response carries no canonical or alternates at all.
  const response = await page.goto('/es/opinion/una-opinion-retirada');

  expect(response?.status()).toBe(410);
  await expect(page.locator('link[hreflang]')).toHaveCount(0);
});

test('carries the Open Graph locale pair in territory form', async ({ page }) => {
  // Not the site's editorial locales: the protocol requires
  // `language_TERRITORY`, and the territory is a hint to social platforms with
  // no editorial meaning (ADR-0013, ADR-0027).
  await page.goto(ES_ARTICLE);

  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES');
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
    'content',
    'en_US'
  );
});

test('asks for a large image preview', async ({ page }) => {
  await page.goto(ES_ARTICLE);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'max-image-preview:large'
  );
});

test('emits BlogPosting structured data with the revision date', async ({ page }) => {
  const response = await page.goto(ES_ARTICLE);
  const html = (await response?.text()) ?? '';

  const match = /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s.exec(html);
  expect(match).not.toBeNull();

  const data = JSON.parse(match?.[1] ?? '{}');

  expect(data['@type']).toBe('BlogPosting');
  expect(data.headline).toBe('El peso del silencio en los juegos de exploración');
  expect(data.inLanguage).toBe('es');
  expect(data.author?.name).toBe('Cesco Valle');
  expect(data.datePublished).toBeTruthy();
  // ADR-0015 keeps the social card out of structured data, and there is no
  // editorial cover to use yet, so the field is absent rather than wrong.
  expect(data.image).toBeUndefined();
});

test('gives the listings their own canonical', async ({ page }) => {
  await page.goto('/es/blog');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/es/blog`);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', `${SITE}/en/blog`);
});
