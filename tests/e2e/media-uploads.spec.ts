import { expect, test } from '@playwright/test';

import type { APIRequestContext, Page } from '@playwright/test';

const POST = 'c1d4e7f0-3a29-4b6c-8d5e-2f7a9b0c1d34';
const ES = '4f8b1c2d-5e6a-4079-8b1c-2d3e4f5a6b7c';
const webp = Buffer.from(
  'UklGRgYCAABXRUJQVlA4WAoAAAAgAAAAAQAAAAAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggGAAAADABAJ0BKgIAAQABQCIlpAADcAD+/W5IAA==',
  'base64'
);
const rawUpload = (request: APIRequestContext, altText: string) =>
  request.post('/admin/media/upload', {
    data: webp,
    headers: {
      Origin: 'http://127.0.0.1:3000',
      'Content-Type': 'image/webp',
      'X-Cesco-Media-Upload': '1',
      'X-Cesco-Media-Metadata': encodeURIComponent(JSON.stringify({ decorative: false, altText })),
    },
  });

type MediaPage = { assets: { altText: string | null; r2Key: string }[]; total: number };

async function createCandidates(request: APIRequestContext, prefix: string) {
  for (let index = 0; index < 21; index++) {
    const response = await rawUpload(request, `${prefix} ${index}`);
    expect(response.status()).toBe(201);
  }
}

async function findCandidatePage(request: APIRequestContext, prefix: string) {
  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const response = await request.get(`/admin/media/page.json?page=${page}`);
    expect(response.status()).toBe(200);
    const result = (await response.json()) as MediaPage;
    pages = Math.max(pages, Math.ceil(result.total / 20));
    const target = page > 1 && result.assets.find((asset) => asset.altText?.startsWith(prefix));
    if (target) return { page, alt: target.altText! };
    page++;
  }
  throw Error('candidate-not-found');
}

async function loadPickerPage(page: Page, target: { page: number; alt: string }) {
  for (let next = 2; next <= target.page; next++) {
    const loaded = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/admin/media/page.json' && url.searchParams.get('page') === `${next}`
      );
    });
    await page.getByRole('button', { name: 'Siguiente' }).click();
    const result = (await (await loaded).json()) as MediaPage;
    const first = result.assets[0];
    if (first) await expect(page.locator(`details img[src="/${first.r2Key}"]`)).toBeVisible();
    if (next === target.page)
      expect(result.assets).toEqual(
        expect.arrayContaining([expect.objectContaining({ altText: target.alt })])
      );
  }
}

async function uploadFromPicker(page: Page, alt: string) {
  const altInput = page.getByLabel('Texto alternativo').first();
  const decorative = page.getByLabel('Imagen decorativa').first();
  await expect(async () => {
    await decorative.setChecked(false);
    await decorative.setChecked(true);
    await expect(altInput).toBeDisabled();
  }).toPass();
  await decorative.setChecked(false);
  await expect(altInput).toBeEnabled();
  await altInput.fill(alt);
  const uploaded = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/admin/media/upload' && response.request().method() === 'POST';
  });
  await page.getByLabel('Elegir imagen').setInputFiles('.wrangler/seed-media.png');
  expect((await uploaded).status()).toBe(201);
}

test('normalizes, delivers, paginates reuse, and keeps the image block stable', async ({
  page,
}, testInfo) => {
  const alt = `Imagen ${crypto.randomUUID()}`;
  await page.goto('/admin/media');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Multimedia');
  await uploadFromPicker(page, alt);
  const image = page.getByRole('img', { name: alt });
  await expect(image).toBeVisible();
  const src = await image.getAttribute('src');
  expect(src).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
  const delivered = await page.request.get(src!);
  expect(delivered.status()).toBe(200);
  expect(delivered.headers()['content-type']).toBe('image/webp');
  await page.screenshot({ path: testInfo.outputPath('media-populated.png'), fullPage: true });

  const prefix = `Reutilizable ${crypto.randomUUID()}`;
  await createCandidates(page.request, prefix);
  const target = await findCandidatePage(page.request, prefix);

  await page.goto(`/admin/posts/${POST}/edit?localization=${ES}`);
  await page.getByText('Insertar imagen').click();
  await expect(page.locator('details ul > li')).toHaveCount(20);
  await loadPickerPage(page, target);
  const reusable = page.getByRole('img', { name: target.alt, exact: true }).locator('..');
  await expect(reusable).toBeVisible();
  const saved = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  await reusable.click();
  await saved;
  const block = page
    .getByRole('textbox', { name: 'Contenido' })
    .locator(`img[alt="${target.alt}"]`);
  await expect(block).toHaveAttribute('data-blockid', /.+/);
  const blockId = await block.getAttribute('data-blockid');
  await page.reload();
  await expect(page.locator(`[data-blockid="${blockId}"]`)).toHaveAttribute('alt', target.alt);
  await page.getByText('Insertar imagen').click();
  await expect(page.locator('details ul > li')).toHaveCount(20);
  await page.screenshot({ path: testInfo.outputPath('editor-image.png'), fullPage: true });
});

test('drains rejected metadata, clamps pages, and shows client rejection', async ({
  page,
}, testInfo) => {
  const forbidden = await page.request.post('/admin/media/upload', {
    data: Buffer.from('not-webp'),
    headers: { 'Content-Type': 'image/webp' },
  });
  expect(forbidden.status()).toBe(403);
  const invalidMetadata = await page.request.post('/admin/media/upload', {
    data: webp,
    headers: {
      Origin: 'http://127.0.0.1:3000',
      'Content-Type': 'image/webp',
      'X-Cesco-Media-Upload': '1',
      'X-Cesco-Media-Metadata': '%7Bbad',
    },
  });
  expect(invalidMetadata.status()).toBe(400);
  expect((await rawUpload(page.request, 'Conexión saludable')).status()).toBe(201);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/media?page=999');
  await expect(page).toHaveURL(/\/admin\/media\?page=\d+$/);
  await expect(page.getByText('No hay imágenes todavía.')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('media-empty-mobile.png'), fullPage: true });
  await page.getByLabel('Elegir imagen').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('media-error-mobile.png'), fullPage: true });
});
