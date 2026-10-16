import { expect, test } from '@playwright/test';

import { waitForAdminHydration } from './helpers/admin-hydration';

test('creates an author through the protected admin workflow', async ({ page }) => {
  const id = crypto.randomUUID();
  const slug = `author-${id}`;
  const name = `Editorial author ${id}`;

  await page.goto('/admin/authors');
  await waitForAdminHydration(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Autores');

  const form = page.getByRole('heading', { name: 'Nuevo autor' }).locator('..');
  const authorName = form.getByLabel('Nombre');
  await expect(authorName).toBeEnabled();
  await authorName.fill(name);
  await form.getByLabel('Slug').fill(slug);
  await form.getByLabel('Sitio web').fill('https://example.com/profile');
  const avatar = form.getByRole('combobox', { name: 'Avatar' });
  await expect(avatar).toBeEnabled();
  await avatar.click();
  await page.getByRole('listbox').getByRole('option').nth(1).click();
  const selectedAvatar = (await avatar.innerText()).trim();
  await form.getByLabel('Perfiles relacionados').fill('https://social.example/profile');
  await form.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('heading', { name })).toBeVisible();
  const saved = page.getByRole('heading', { name }).locator('..');
  await expect(saved.getByLabel('Slug')).toHaveValue(slug);
  await expect(saved.getByLabel('Sitio web')).toHaveValue('https://example.com/profile');
  await expect(saved.getByRole('combobox', { name: 'Avatar' })).toContainText(selectedAvatar);
  await expect(saved.getByLabel('Perfiles relacionados')).toHaveValue(
    'https://social.example/profile'
  );
});
