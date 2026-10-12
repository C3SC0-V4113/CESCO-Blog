import { expect, test } from '@playwright/test';

test('creates an author through the protected admin workflow', async ({ page }) => {
  const id = crypto.randomUUID();
  const slug = `author-${id}`;
  const name = `Editorial author ${id}`;

  await page.goto('/admin/authors');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Autores');
  // The screen is inert until React commits, and a field typed into before
  // that would not take the text. The island losing `ssr` comes earlier than
  // the commit, so the inert attribute itself is what to wait on.
  await expect(page.locator('[inert]')).toHaveCount(0);

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
