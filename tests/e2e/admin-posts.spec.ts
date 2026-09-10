import { expect, test } from '@playwright/test';

test('refuses admin actions outside the protected path and writes nothing', async ({
  page,
  request,
}) => {
  const slug = `bypass-${crypto.randomUUID()}`;
  // A JSON body is what the action parser reads, and it is exempt from Astro's
  // cross-site form check, so both requests would reach the action unguarded.
  const call = {
    data: { section: 'analysis', locale: 'es', slug },
    headers: { 'Content-Type': 'application/json' },
  };
  // Astro decodes each name segment, so this form call resolves to
  // admin.createPost on a public page.
  expect((await request.post('/es/?_action=%2561dmin.createPost', call)).status()).toBe(403);
  // Astro reads the name after the last `/_actions/`, so this RPC call resolves
  // to admin.createPost on a path the Access rule does not cover.
  expect((await request.post('/_actions/x/_actions/admin.createPost', call)).status()).toBe(403);

  // The slug is unique per locale, so creating it succeeds only if neither
  // refused request wrote a row.
  await page.goto('/admin/posts/new');
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(page.getByRole('cell', { name: slug })).toBeVisible();
});

test('lists post aggregates and keeps implemented destinations live', async ({ page }) => {
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
  await expect(page.getByRole('link', { name: 'Multimedia' })).toHaveAttribute(
    'href',
    '/admin/media'
  );
  for (const label of ['Revisión', 'Series', 'Autores'])
    await expect(page.getByRole('button', { name: label })).toBeDisabled();
});

test('sends a page past the end of the list to its last page', async ({ page }) => {
  await page.goto('/admin/posts?page=99');
  await expect(page).toHaveURL(/\/admin\/posts(\?page=\d+)?$/);
  await expect(page).not.toHaveURL(/page=99/);
  await expect(page.getByText('Todavía no hay publicaciones.')).toBeHidden();
  await expect(page.getByRole('row').nth(1)).toBeVisible();
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
