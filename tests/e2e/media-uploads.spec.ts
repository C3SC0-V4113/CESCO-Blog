import { expect, test } from '@playwright/test';

import type { APIRequestContext, Page } from '@playwright/test';

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

async function openNewDraft(page: Page) {
  const slug = `media-uploads-${crypto.randomUUID()}`;
  await page.goto('/admin/posts/new');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: slug }) });
  await row.getByRole('link', { name: 'Borrador' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor');
}

async function createCandidates(request: APIRequestContext, prefix: string) {
  for (let index = 0; index < 21; index++) {
    const response = await rawUpload(request, `${prefix} ${index}`);
    expect(response.status()).toBe(201);
  }
}

let candidatePrefix: string | undefined;
let candidateSetup: Promise<void> | undefined;

async function findReusableCandidate(request: APIRequestContext) {
  if (!candidateSetup) {
    candidatePrefix = `Reutilizable ${crypto.randomUUID()}`;
    candidateSetup = createCandidates(request, candidatePrefix);
  }
  await candidateSetup;
  return findCandidatePage(request, candidatePrefix!);
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
    if (target) return { alt: target.altText! };
    page++;
  }
  throw Error('candidate-not-found');
}

async function loadPickerPage(page: Page, target: { alt: string }) {
  let currentPage = 1;
  for (let scan = 0; scan < 3; scan++) {
    while (await page.getByRole('button', { name: 'Siguiente' }).count()) {
      const next = currentPage + 1;
      const loaded = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/admin/media/page.json' && url.searchParams.get('page') === `${next}`
        );
      });
      await page.getByRole('button', { name: 'Siguiente' }).click();
      const result = (await (await loaded).json()) as MediaPage;
      currentPage = next;
      const candidate = result.assets.find((asset) => asset.altText === target.alt);
      if (candidate) {
        await expect(
          page.locator(`#editor-image-picker img[src="/${candidate.r2Key}"]`)
        ).toBeVisible();
        return;
      }
      const first = result.assets[0];
      if (first)
        await expect(page.locator(`#editor-image-picker img[src="/${first.r2Key}"]`)).toBeVisible();
    }
    while (currentPage > 1) {
      const previous = currentPage - 1;
      const loaded = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/admin/media/page.json' &&
          url.searchParams.get('page') === `${previous}`
        );
      });
      await page.getByRole('button', { name: 'Anterior' }).click();
      await loaded;
      currentPage = previous;
    }
  }
  throw Error('candidate-not-found-in-picker');
}

async function uploadFromPicker(page: Page, alt: string) {
  const altInput = page.getByLabel('Texto alternativo').first();
  const decorative = page.getByRole('checkbox', { name: 'Imagen decorativa' }).first();
  await expect(altInput).toBeEnabled();
  await expect(decorative).toBeEnabled();
  await decorative.setChecked(true);
  await expect(altInput).toBeDisabled();
  await decorative.setChecked(false);
  await expect(altInput).toBeEnabled();
  await altInput.fill(alt);
  const fileInput = page.getByLabel('Elegir imagen');
  await expect(fileInput).toBeEnabled();
  const uploaded = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/admin/media/upload' && response.request().method() === 'POST';
  });
  await fileInput.setInputFiles('.wrangler/seed-media.png');
  expect((await uploaded).status()).toBe(201);
}

test('associates visible checkbox labels in upload and metadata forms', async ({ page }) => {
  await page.goto('/admin/media');
  const uploadRegion = page.getByRole('region', { name: 'Carga de imagen' });
  const uploadDecorative = uploadRegion.getByRole('checkbox', { name: 'Imagen decorativa' });
  const uploadAlt = uploadRegion.getByLabel('Texto alternativo');
  await expect(uploadDecorative).toBeEnabled();
  await expect(uploadAlt).toBeEnabled();
  await uploadRegion.getByText('Imagen decorativa', { exact: true }).click();
  await expect(uploadDecorative).toBeChecked();
  await expect(uploadAlt).toBeDisabled();
  await uploadRegion.getByText('Imagen decorativa', { exact: true }).click();
  await expect(uploadDecorative).not.toBeChecked();
  await expect(uploadAlt).toBeEnabled();

  const metadata = page.locator('details').first();
  await metadata.locator('summary').click();
  const metadataForm = metadata.locator('form');
  const metadataDecorative = metadataForm.getByRole('checkbox', { name: 'Imagen decorativa' });
  await expect(metadataDecorative).toBeEnabled();
  await metadataForm.getByText('Imagen decorativa', { exact: true }).click();
  await expect(metadataDecorative).toBeChecked();

  const ownWork = metadataForm.getByRole('checkbox', { name: 'Trabajo propio' });
  await expect(ownWork).toBeEnabled();
  const ownWorkLabel = metadataForm.locator('label').filter({ hasText: 'Trabajo propio' });
  await ownWork.uncheck();
  await ownWorkLabel.click();
  await expect(ownWork).toBeChecked();
});

test('normalizes, delivers, paginates reuse, and keeps the image block stable', async ({
  page,
}, testInfo) => {
  const alt = `Imagen ${crypto.randomUUID()}`;
  await page.goto('/admin/media');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Multimedia');
  await uploadFromPicker(page, alt);
  // The caption names the card, so its image carries an empty alt.
  const image = page.getByRole('listitem').filter({ hasText: alt }).locator('img');
  await expect(image).toBeVisible();
  const src = await image.getAttribute('src');
  expect(src).toMatch(/^\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
  const delivered = await page.request.get(src!);
  expect(delivered.status()).toBe(200);
  expect(delivered.headers()['content-type']).toBe('image/webp');
  await page.screenshot({ path: testInfo.outputPath('media-populated.png'), fullPage: true });

  const target = await findReusableCandidate(page.request);

  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewDraft(page);
  const pickerTrigger = page.getByRole('button', { name: 'Insertar imagen' });
  await expect(pickerTrigger).toBeEnabled();
  await pickerTrigger.click();
  const picker = page.getByRole('complementary', { name: 'Insertar imagen' });
  await expect(picker.locator('ul > li')).toHaveCount(20);
  await loadPickerPage(page, target);
  const reusable = page.getByRole('button', { name: target.alt, exact: true });
  await expect(reusable).toBeVisible();
  const saved = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  await reusable.click();
  const saveResponse = await saved;
  expect(saveResponse.status()).toBeGreaterThanOrEqual(200);
  expect(saveResponse.status()).toBeLessThan(300);
  const saveResult = (await saveResponse.json()) as { error?: { code?: string } };
  expect(saveResult.error?.code).not.toBe('CONFLICT');
  const block = page
    .getByRole('textbox', { name: 'Contenido' })
    .locator(`img[alt="${target.alt}"]`);
  await expect(block).toHaveAttribute('data-blockid', /.+/);
  const blockId = await block.getAttribute('data-blockid');
  await page.reload();
  await expect(page.locator(`[data-blockid="${blockId}"]`)).toHaveAttribute('alt', target.alt);
  await expect(pickerTrigger).toBeEnabled();
  await pickerTrigger.click();
  await expect(picker.locator('ul > li')).toHaveCount(20);
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
  const fileInput = page.getByLabel('Elegir imagen');
  await expect(fileInput).toBeEnabled();
  await fileInput.setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('media-error-mobile.png'), fullPage: true });
});
