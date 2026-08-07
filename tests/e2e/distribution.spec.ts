import { expect, test } from '@playwright/test';

/**
 * The syndication endpoints (ADR-0014), served from D1 on request rather than
 * generated at build time.
 */

const SITE = 'https://checkpoint.cescovalle.com';

test('serves a per-locale feed with the article in it', async ({ request }) => {
  const response = await request.get('/es/rss.xml');
  const xml = await response.text();

  expect(response.status()).toBe(200);
  expect(xml).toContain('El peso del silencio en los juegos de exploración');
  expect(xml).toContain(`${SITE}/es/analisis/el-peso-del-silencio`);
});

test('identifies items by a non-permalink guid', async ({ request }) => {
  // The guid must not be the URL: slugs are mutable, and a rename would deliver
  // the article to every subscriber again as though it were new (ADR-0014).
  const xml = await (await request.get('/es/rss.xml')).text();

  expect(xml).toContain('isPermaLink="false"');
  expect(xml).not.toContain('isPermaLink="true"');
  // The guid is the localization id, so the canonical URL must not appear
  // inside a guid element.
  expect(xml).not.toMatch(/<guid[^>]*>https?:/);
});

test('keeps each feed to its own locale', async ({ request }) => {
  const spanish = await (await request.get('/es/rss.xml')).text();
  const english = await (await request.get('/en/rss.xml')).text();

  expect(spanish).toContain('El peso del silencio');
  expect(spanish).not.toContain('The weight of silence');
  expect(english).toContain('The weight of silence');
});

test('does not syndicate a withdrawn post', async ({ request }) => {
  // Its URL answers 410; advertising it would invite crawlers back.
  const xml = await (await request.get('/es/rss.xml')).text();

  expect(xml).not.toContain('Una opinión retirada');
});

test('lists articles and listing surfaces in the sitemap', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  const xml = await response.text();

  expect(response.status()).toBe(200);
  expect(xml).toContain(`${SITE}/es/analisis/el-peso-del-silencio`);
  expect(xml).toContain(`${SITE}/en/analysis/the-weight-of-silence`);
  expect(xml).toContain(`${SITE}/es/blog`);
  // Withdrawn stays out of the sitemap too.
  expect(xml).not.toContain('una-opinion-retirada');
});

test('gives every article a lastmod', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();

  expect(xml).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
});

test('points robots.txt at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test('tags the endpoints so an editorial event can purge them', async ({ request }) => {
  const feed = await request.get('/es/rss.xml');
  const sitemap = await request.get('/sitemap.xml');

  expect(feed.headers()['cache-tag']).toContain('rss');
  expect(sitemap.headers()['cache-tag']).toContain('sitemap');
});
