import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

// A post of its own, so inserting images never races a test on the seeded draft.
async function openNewDraft(page: Page) {
  const slug = `editor-media-${crypto.randomUUID()}`;
  await page.goto('/admin/posts/new');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: slug }) });
  await row.getByRole('link', { name: 'Borrador' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor');
  await expect(page.locator('[inert]')).toHaveCount(0);
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
  await expect(page.getByRole('textbox', { name: 'Título' })).toBeEnabled();
  const canvas = page.getByRole('textbox', { name: 'Contenido' });
  const alt = `Lienzo ${crypto.randomUUID()}`;
  const blocks = canvas.locator(`img[alt="${alt}"]`);

  // Canvas uploads obey the picker's alt-text rule, so the text goes there first.
  await page.getByRole('button', { name: 'Insertar imagen' }).click();
  const picker = page.getByRole('complementary', { name: 'Insertar imagen' });
  await expect(picker).toBeVisible();
  const uploadRegion = picker.getByRole('region', { name: 'Carga de imagen' });
  await expect(uploadRegion).toBeVisible();
  const altInput = uploadRegion.getByLabel('Texto alternativo');
  await expect(altInput).toBeEnabled();
  await altInput.fill(alt);

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

test('opens the desktop image picker beside the editor and returns focus on Escape', async ({
  page,
}) => {
  await openNewDraft(page);
  expect(await page.evaluate(() => window.innerWidth)).toBe(1280);
  await expect(page.getByRole('textbox', { name: 'Título' })).toBeEnabled();
  const trigger = page.getByRole('button', { name: 'Insertar imagen' });

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).not.toHaveAttribute('aria-pressed');
  await trigger.click();
  const panel = page.getByRole('complementary', { name: 'Insertar imagen' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Insertar imagen' })).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-controls', (await panel.getAttribute('id')) ?? '');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  const canvas = page.getByRole('textbox', { name: 'Contenido' });
  await canvas.click();
  await page.keyboard.type('Texto junto al panel');
  await expect(canvas).toContainText('Texto junto al panel');
  const firstAsset = panel.getByRole('list').getByRole('button').first();
  const assetAlt = (await firstAsset.innerText()).trim();
  const inserted = canvas.locator('img').first();
  await firstAsset.click();
  await expect(inserted).toHaveCount(1);
  await expect(inserted).toHaveAttribute('alt', assetAlt);
  await expect(panel).toBeVisible();
  await expect(canvas).toBeFocused();

  await panel.getByRole('link', { name: 'Ir a la biblioteca multimedia' }).focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Cerrar selector de imágenes' }).click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 1279, height: 720 });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Insertar imagen' });
  await expect(dialog).toBeVisible();
  await expect(panel).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('uses a bottom sheet on mobile and queues a paste until its upload form mounts', async ({
  page,
}) => {
  const png = await readFile('.wrangler/seed-media.png', { encoding: 'base64' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openNewDraft(page);
  await expect(page.getByRole('textbox', { name: 'Título' })).toBeEnabled();
  const trigger = page.getByRole('button', { name: 'Insertar imagen' });
  const canvas = page.getByRole('textbox', { name: 'Contenido' });

  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Insertar imagen' });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  const firstAsset = dialog.getByRole('list').getByRole('button').first();
  const assetAlt = (await firstAsset.innerText()).trim();
  const inserted = canvas.locator('img').first();
  await firstAsset.click();
  await expect(inserted).toHaveCount(1);
  await expect(inserted).toHaveAttribute('alt', assetAlt);
  await expect(dialog).toBeHidden();

  await canvas.evaluate((element, base64) => {
    const data = new DataTransfer();
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    data.items.add(new File([bytes], 'pegada.png', { type: 'image/png' }));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    element.dispatchEvent(event);
  }, png);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Escribe el texto alternativo o marca la imagen como decorativa.'
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
