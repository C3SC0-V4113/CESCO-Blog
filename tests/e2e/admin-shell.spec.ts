import { expect, test } from '@playwright/test';

import type { APIRequestContext } from '@playwright/test';

async function collectJavaScriptGraph(request: APIRequestContext, entryPoints: string[]) {
  const pending = [...entryPoints];
  const modules = new Map<string, string>();

  while (pending.length > 0) {
    const source = pending.pop();
    if (!source || modules.has(source)) continue;

    const response = await request.get(source);
    expect(response.ok()).toBe(true);
    const body = await response.text();
    modules.set(source, body);

    for (const match of body.matchAll(/\b(?:from|import)\s*(?:\(\s*)?["']([^"']+\.js)["']/g)) {
      pending.push(new URL(match[1], source).href);
    }
  }

  return modules;
}

test('renders and hydrates the private editorial shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin');

  await expect(page).toHaveTitle('Panel editorial | Checkpoint');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Panel editorial');

  const trigger = page.getByRole('button', { name: 'Abrir navegación' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Cerrar navegación' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );

  await expect(page.getByRole('link', { name: 'Publicaciones' })).toHaveAttribute(
    'href',
    '/admin/posts'
  );
  for (const label of ['Multimedia', 'Revisión', 'Series', 'Autores']) {
    await expect(page.getByRole('button', { name: label })).toBeDisabled();
  }

  await expect(page.locator('main a[href]')).toHaveCount(0);

  await page.screenshot({ path: testInfo.outputPath('admin-shell.png'), fullPage: true });
});

test('keeps the admin application out of public route bundles', async ({ page, request }) => {
  await page.goto('/es/');

  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name)
  );
  const markup = await page.content();
  const documentModules = [...markup.matchAll(/["']([^"']+\.js)["']/g)].map(
    (match) => new URL(match[1], page.url()).href
  );
  const entryPoints = [
    ...resources.filter((source) => new URL(source).pathname.endsWith('.js')),
    ...documentModules,
  ];
  const modules = await collectJavaScriptGraph(request, entryPoints);

  for (const source of resources) expect(new URL(source).pathname).not.toMatch(/admin/i);
  expect(modules.size).toBeGreaterThan(0);
  for (const source of modules.keys()) expect(new URL(source).pathname).not.toMatch(/admin/i);
  expect([...modules.values()].join('\n')).not.toContain('Borradores en curso');
});

test('preserves public i18n routing around the language-neutral admin', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/es\/$/);

  expect((await page.goto('/en/'))?.status()).toBe(200);
  expect((await page.goto('/es/privacidad'))?.status()).toBe(200);

  expect((await page.goto('/privacidad'))?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página no existe');
});
