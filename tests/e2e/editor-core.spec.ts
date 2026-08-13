import { expect, test } from '@playwright/test';

const SEEDED_POST = 'c1d4e7f0-3a29-4b6c-8d5e-2f7a9b0c1d34';
const SEEDED_ES = '4f8b1c2d-5e6a-4079-8b1c-2d3e4f5a6b7c';
const SEEDED_EN = '5a9c2d3e-6f70-418a-9c2d-3e4f5a6b7c8d';

test('edits one localization with durable autosave and preserves conflicts', async ({
  browser,
  page,
}, testInfo) => {
  const slug = `editor-${crypto.randomUUID()}`;
  await page.goto('/admin/posts/new');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: slug }) });
  const editLink = row.getByRole('link', { name: 'Borrador' });
  await expect(editLink).toHaveAttribute('href', /\/admin\/posts\/.+\/edit\?localization=.+/);
  await expect(row.getByText('Sin crear')).not.toHaveAttribute('href');

  await editLink.click();
  const other = await browser.newPage();
  await other.goto(page.url());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor');
  const locales = page.getByRole('group', { name: 'Localización' });
  await expect(locales.getByRole('button', { name: 'Español (actual)' })).toBeDisabled();
  await expect(locales.getByRole('button', { name: 'Inglés (no disponible)' })).toBeDisabled();
  const title = page.getByLabel('Título');
  await expect(title).toHaveAttribute('maxlength', '300');
  await expect(page.getByLabel('Resumen')).toHaveAttribute('maxlength', '1000');
  await title.focus();
  await page.keyboard.insertText('x'.repeat(301));
  await expect(title).toHaveValue('x'.repeat(300));
  await page.reload();
  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath('editor-mobile.png'), fullPage: true });

  const saveRoute = '**/_actions/admin.saveDraft/';
  await page.route(saveRoute, (route) => route.abort());
  await page.getByLabel('Título').fill('Fallo local');
  await expect(page.getByRole('status')).toContainText('No se pudo guardar');
  await page.screenshot({ path: testInfo.outputPath('editor-error.png'), fullPage: true });
  await page.unroute(saveRoute);
  const saved = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  await page.getByLabel('Título').fill('Borrador guardado');
  await saved;
  await expect(page.getByRole('status')).toHaveText('Guardado');
  const bodySaved = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  const body = page.getByRole('textbox', { name: 'Contenido' });
  await body.fill('Contenido estable');
  await page.getByRole('button', { name: 'Encabezado 2' }).click();
  await bodySaved;
  await expect(body.locator('h2')).toHaveText('Contenido estable');
  const block = page.locator('.ProseMirror [data-blockid]');
  await expect(block).toHaveAttribute('data-blockid', /.+/);
  const blockId = await block.evaluate((element) => element.getAttribute('data-blockid'));

  await other.getByLabel('Título').fill('Contenido local en conflicto');
  await expect(other.getByRole('status')).toContainText('Recarga para continuar');
  await expect(other.getByLabel('Título')).toHaveValue('Contenido local en conflicto');
  await other.screenshot({ path: testInfo.outputPath('editor-conflict.png'), fullPage: true });
  await page.reload();
  await expect(page.getByLabel('Título')).toHaveValue('Borrador guardado');
  await expect(page.locator(`[data-blockid="${blockId}"]`)).toContainText('Contenido estable');
  await other.close();
});

test('flushes before switching existing localizations and blocks a failed switch', async ({
  page,
}) => {
  const esUrl = `/admin/posts/${SEEDED_POST}/edit?localization=${SEEDED_ES}`;
  await page.goto(esUrl);
  const changedTitle = `Cambio ${crypto.randomUUID()}`;
  const saved = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  await page.getByLabel('Título').fill(changedTitle);
  await page.getByRole('link', { name: 'Inglés' }).click();
  await saved;
  await expect(page).toHaveURL(new RegExp(`localization=${SEEDED_EN}$`));
  await expect(page.getByLabel('Título')).toHaveValue('The weight of silence in exploration games');

  await page.getByRole('link', { name: 'Español' }).click();
  await expect(page).toHaveURL(new RegExp(`localization=${SEEDED_ES}$`));
  await expect(page.getByLabel('Título')).toHaveValue(changedTitle);

  await page.route('**/_actions/admin.saveDraft/', (route) => route.abort());
  await page.getByLabel('Título').fill('Edición local sin guardar');
  await page.getByRole('link', { name: 'Inglés' }).click();
  await expect(page.getByRole('status')).toContainText('No se pudo guardar');
  await expect(page).toHaveURL(new RegExp(`localization=${SEEDED_ES}$`));
  await expect(page.getByLabel('Título')).toHaveValue('Edición local sin guardar');
  await page.unroute('**/_actions/admin.saveDraft/');
  const retried = page.waitForResponse((response) =>
    response.url().includes('/_actions/admin.saveDraft')
  );
  await page.getByRole('button', { name: 'Guardar ahora' }).click();
  await retried;
  await expect(page.getByRole('status')).toHaveText('Guardado');
});
