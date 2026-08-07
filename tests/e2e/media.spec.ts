import { expect, test } from '@playwright/test';

/**
 * Public media delivery (ADR-0033, ADR-0028).
 *
 * The seed puts one object in local R2 and one `media_assets` row beside it, so
 * these run against real storage rather than a stub.
 */

const KEY = 'media/2026/08/6d1f8a90-2b3c-4d5e-8f70-1a2b3c4d5e6f.png';

test('serves a stored object at its key', async ({ request }) => {
  const response = await request.get(`/${KEY}`);

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  expect((await response.body()).byteLength).toBeGreaterThan(0);
});

test('caches an object for a year, immutably', async ({ request }) => {
  // Safe only because ADR-0028 derives the key once and never rewrites it, so a
  // key names one byte sequence for as long as it exists.
  const response = await request.get(`/${KEY}`);
  const cacheControl = response.headers()['cache-control'] ?? '';

  expect(cacheControl).toContain('max-age=31536000');
  expect(cacheControl).toContain('immutable');
});

test('tags the response so deleting the asset can purge it', async ({ request }) => {
  // The id is read back out of the key, which is what keeps this path free of
  // database queries (ADR-0011).
  const response = await request.get(`/${KEY}`);

  expect(response.headers()['cache-tag']).toBe('media-6d1f8a90-2b3c-4d5e-8f70-1a2b3c4d5e6f');
});

test('forbids the browser from guessing the type', async ({ request }) => {
  // Half of the SVG defence. The allow-list is the other half; without this a
  // browser may decide for itself what a file is regardless of what we said.
  const response = await request.get(`/${KEY}`);

  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});

test('answers 304 when the caller already has the object', async ({ request }) => {
  const first = await request.get(`/${KEY}`);
  const etag = first.headers()['etag'];

  expect(etag).toBeTruthy();

  const second = await request.get(`/${KEY}`, { headers: { 'If-None-Match': etag! } });

  expect(second.status()).toBe(304);
  expect((await second.body()).byteLength).toBe(0);
});

test('answers 404 for a key that stores nothing', async ({ request }) => {
  const response = await request.get('/media/2026/08/00000000-0000-4000-8000-000000000000.png');

  expect(response.status()).toBe(404);
});

test('caches a miss briefly rather than for a year', async ({ request }) => {
  // A card referenced by a revision published seconds before its upload
  // finished is a race, not a fact. A long-lived cached miss outlives the
  // upload by the length of the cache.
  const response = await request.get('/media/2026/08/00000000-0000-4000-8000-000000000000.png');
  const cacheControl = response.headers()['cache-control'] ?? '';

  expect(cacheControl).toContain('max-age=60');
  expect(cacheControl).not.toContain('immutable');
});

test('does not let a key climb out of the media prefix', async ({ request }) => {
  const response = await request.get('/media/../wrangler.jsonc');

  expect(response.status()).not.toBe(200);
});
