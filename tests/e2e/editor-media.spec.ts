import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

// A post of its own, so inserting images never races a test on the seeded draft.
async function openNewDraft(page: Page) {
  const slug = `editor-media-${crypto.randomUUID()}`;
  await page.goto('/admin/posts/new');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: slug }) });
  await row.getByRole('link', { name: 'Borrador' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor');
}

const nextUpload = (page: Page) =>
  page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/admin/media/upload' &&
      response.request().method() === 'POST'
  );

test('uploads an image pasted or dropped on the canvas and inserts an image block', async ({
  page,
}) => {
  // Read here rather than at import: the seed writes it after the spec is collected.
  const png = await readFile('.wrangler/seed-media.png', { encoding: 'base64' });
  await openNewDraft(page);
  const canvas = page.getByRole('textbox', { name: 'Contenido' });
  const alt = `Lienzo ${crypto.randomUUID()}`;
  const blocks = canvas.locator(`img[alt="${alt}"]`);

  // Canvas uploads obey the picker's alt-text rule, so the text goes there first.
  await page.getByText('Insertar imagen').click();
  await page
    .getByRole('region', { name: 'Carga de imagen' })
    .getByLabel('Texto alternativo')
    .fill(alt);

  await canvas.click();
  const pasted = nextUpload(page);
  await canvas.evaluate((element, base64) => {
    const data = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    data.items.add(new File([bytes], 'pegada.png', { type: 'image/png' }));
    // Not every engine honours `clipboardData` in the ClipboardEvent constructor,
    // so a plain event carries it; ProseMirror only reads the property.
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    element.dispatchEvent(event);
  }, png);
  expect((await pasted).status()).toBe(201);
  await expect(blocks).toHaveCount(1);
  await expect(blocks).toHaveAttribute('src', /^\/media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
  await expect(blocks).toHaveAttribute('data-blockid', /.+/);

  // Measured in the task that dispatches: the page scrolls smoothly after the
  // paste, so a box read by an earlier call can be stale by the time the drop
  // fires and point below the canvas, where ProseMirror ignores it.
  const dropped = nextUpload(page);
  await canvas.evaluate((element, base64) => {
    const data = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    data.items.add(new File([bytes], 'soltada.png', { type: 'image/png' }));
    const box = element.getBoundingClientRect();
    element.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: data,
        clientX: box.left + box.width / 2,
        clientY: box.bottom - 8,
      })
    );
  }, png);
  expect((await dropped).status()).toBe(201);
  // Dropped below the first image, so it lands after it rather than replacing it.
  await expect(blocks).toHaveCount(2);
});
