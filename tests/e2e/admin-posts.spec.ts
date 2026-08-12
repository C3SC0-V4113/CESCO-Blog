import { expect, test } from '@playwright/test';

test('rejects admin actions invoked through a public form route', async ({ request }) => {
  const data = { section: 'analysis', locale: 'es', slug: `form-${crypto.randomUUID()}` };
  expect((await request.post('/es/?_action=admin.createPost', { data })).status()).toBe(403);
});

test('lists post aggregates and keeps only the posts destination live', async ({ page }) => {
  await page.goto('/admin/posts');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Publicaciones');
  await expect(page.getByRole('link', { name: 'Publicaciones', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(page.getByRole('link', { name: 'Nueva publicación' })).toHaveAttribute(
    'href',
    '/admin/posts/new'
  );
  for (const label of ['Multimedia', 'Revisión', 'Series', 'Autores'])
    await expect(page.getByRole('button', { name: label })).toBeDisabled();
});

test('creates only the first localization and returns to the aggregate list', async ({ page }) => {
  const slug = `e2e-${crypto.randomUUID()}`;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/posts/new');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nueva publicación');
  await page.getByLabel('Sección').selectOption('opinion');
  await page.getByLabel('Idioma inicial').selectOption('en');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: slug }) });
  await expect(row).toContainText(/Opiniones.*Sin crear.*Borrador/);
});
