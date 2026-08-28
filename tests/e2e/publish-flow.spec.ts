import { expect, test } from '@playwright/test';
import { parse } from 'devalue';

import { publishE2eFixture } from '../../scripts/publish-e2e-fixtures';

import type { Page } from '@playwright/test';

const actionResponse = (page: Page, name: string) =>
  page.waitForResponse((response) => response.url().includes(`/_actions/admin.${name}`));

async function findEditorUrl(page: Page, slug: string) {
  let current = 1;
  let totalPages = 1;
  do {
    const response = await page.goto(
      current === 1 ? '/admin/posts' : `/admin/posts?page=${current}`
    );
    expect(response?.ok()).toBe(true);
    const pagination = page.getByRole('navigation', { name: 'Paginación' });
    if (await pagination.count()) {
      const match = /^(\d+) \/ (\d+)$/.exec((await pagination.locator('span').innerText()).trim());
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBe(current);
      totalPages = Math.max(totalPages, Number(match![2]));
    }
    const editorLink = page
      .getByRole('row')
      .filter({ hasText: slug })
      .getByRole('link', { name: 'Borrador' });
    if ((await editorLink.count()) === 1) {
      await expect(editorLink).toHaveAttribute('href', /\/admin\/posts\/.+\/edit\?localization=/);
      return editorLink.getAttribute('href');
    }
    current++;
  } while (current <= totalPages);
  throw Error(`Publish fixture not found in ${totalPages} post pages`);
}

async function findReviewFixture(page: Page, localizationId: string) {
  const firstResponse = await page.goto('/admin/review');
  expect(firstResponse?.ok()).toBe(true);
  let current = 1;
  let pageSize = 0;
  let totalPages = 1;
  while (current <= totalPages) {
    const rangeText = await page
      .getByRole('region', { name: 'Cola de revisión' })
      .getByText(/^Mostrando \d+–\d+ de \d+$/)
      .innerText();
    const match = /^Mostrando (\d+)–(\d+) de (\d+)$/.exec(rangeText);
    expect(match).toBeTruthy();
    const [, first, last, total] = match!.map(Number);
    if (current === 1) pageSize = last! - first! + 1;
    expect(total).toBeGreaterThan(50);
    expect(first).toBe((current - 1) * pageSize + 1);
    totalPages = Math.max(totalPages, Math.ceil(total! / pageSize));

    const fixture = page.locator(`a[href*="localization=${localizationId}"]`);
    if ((await fixture.count()) === 1) return { fixture, current, rangeText };
    if (current === totalPages) break;

    const next = current + 1;
    const loaded = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().resourceType() === 'document' &&
        url.pathname === '/admin/review' &&
        url.searchParams.get('page') === String(next)
      );
    });
    await page.getByRole('link', { name: 'Siguiente' }).click();
    expect((await loaded).ok()).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/admin/review\\?page=${next}(?:&|$)`));
    current = next;
  }
  throw Error(`Review fixture not found in ${totalPages} pages`);
}

test('reviews, publishes, withdraws, republishes, and renames one localization', async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const fixture = publishE2eFixture(project, testInfo.retry);
  const originalSlug = fixture.slug;
  const title = `Publicación ${crypto.randomUUID()}`;

  const editorUrl = await findEditorUrl(page, originalSlug);
  expect(editorUrl).toBeTruthy();
  const match = /^\/admin\/posts\/([^/]+)\/edit\?localization=([^&]+)$/.exec(editorUrl!);
  expect(match).toBeTruthy();
  const [, postId, localizationId] = match!;

  await page.goto(editorUrl!);
  await page.getByLabel(/Título/).fill(title);
  const saved = actionResponse(page, 'saveDraft');
  await page.getByRole('link', { name: /Ir a revisión/ }).click();
  await saved;
  await expect(page).toHaveURL(
    new RegExp(`/admin/review\\?post=${postId}&localization=${localizationId}`)
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Revisión/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editor' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(title);
  await expect(
    page.getByText(`Cuerpo revisado ${project}, intento ${fixture.retry}`)
  ).toBeVisible();
  await expect(page.getByText('const reviewed = true;')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Portada revisada' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(title);
  await page.screenshot({ path: testInfo.outputPath('review-desktop.png'), fullPage: true });

  const published = actionResponse(page, 'publish');
  await page.getByRole('button', { name: /^Publicar/ }).click();
  expect((await published).status()).toBe(200);
  await expect(page.getByRole('button', { name: /Publicar nueva revisión/ })).toBeVisible();
  const publicUrl = `/es/analisis/${originalSlug}`;
  await page.goto(publicUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);

  await page.goto(`/admin/review?post=${postId}&localization=${localizationId}`);
  const unpublished = actionResponse(page, 'unpublish');
  await page.getByRole('button', { name: 'Despublicar' }).click();
  expect((await unpublished).status()).toBe(200);
  await expect(page.getByRole('button', { name: /^Publicar$/ })).toBeVisible();
  const gone = await page.request.get(publicUrl);
  expect(gone.status()).toBe(410);
  expect(gone.headers()['cache-tag']).toContain(`post-${postId}`);

  const republished = actionResponse(page, 'publish');
  await page.getByRole('button', { name: /^Publicar$/ }).click();
  expect((await republished).status()).toBe(200);
  await expect(page.getByRole('button', { name: /Publicar nueva revisión/ })).toBeVisible();

  const bypassSlug = `sin-confirmar-${crypto.randomUUID()}`;
  const bypass = await page.request.post('/_actions/admin.renameLocalization', {
    data: {
      postId,
      localizationId,
      slug: bypassSlug,
      acknowledgePermanentRedirect: false,
    },
  });
  expect(bypass.status()).toBe(200);
  expect(bypass.headers()['content-type']).toMatch(/^application\/json\+devalue(?:;|$)/);
  const bypassRawBody = await bypass.text();
  const safeResultData: unknown = parse(bypassRawBody);
  expect(safeResultData).toEqual({
    status: 'rejected',
    code: 'PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED',
  });
  expect(bypassRawBody).not.toContain('redirect-acknowledgement-required');
  expect(JSON.stringify(safeResultData)).not.toContain('redirect-acknowledgement-required');
  await page.reload();
  await expect(page.getByLabel('Slug')).toHaveValue(originalSlug);

  const slug = `publicado-${crypto.randomUUID()}`;
  await page.getByLabel('Slug').fill(slug);
  await expect(page.getByText(/Esta localización ya se publicó/)).toBeVisible();
  const renameButton = page.getByRole('button', { name: 'Cambiar slug' });
  await expect(renameButton).toBeDisabled();
  await page.getByRole('checkbox', { name: /Confirmo/ }).check();
  const renamed = actionResponse(page, 'renameLocalization');
  await renameButton.click();
  expect((await renamed).status()).toBe(200);
  await expect(page.getByRole('checkbox', { name: /Confirmo/ })).not.toBeChecked();
  await expect(page.getByLabel('Slug')).toHaveValue(slug);
  const old = await page.request.get(publicUrl, { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers()['location']).toBe(`/es/analisis/${slug}`);
  expect(old.headers()['cache-tag']).toContain(`post-${postId}`);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath('review-mobile.png'), fullPage: true });
  const finalUnpublish = actionResponse(page, 'unpublish');
  await page.getByRole('button', { name: 'Despublicar' }).click();
  expect((await finalUnpublish).status()).toBe(200);
});

test('paginates the complete review queue', async ({ page }) => {
  const located = await findReviewFixture(page, 'f2000000-0000-4000-8000-000000000051');
  expect(located.current).toBeGreaterThan(1);
  await expect(located.fixture).toBeVisible();
  await expect(page.getByText(located.rangeText)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Anterior' })).toBeVisible();
  await page.goto('/admin/review?page=999999999');
  await expect(page).toHaveURL(/\/admin\/review\?page=\d+$/);
  expect(Number(new URL(page.url()).searchParams.get('page'))).toBeGreaterThan(1);
  await expect(page.getByRole('link', { name: 'Siguiente' })).toHaveCount(0);
});

test('never renders unsafe attribution URL schemes from legacy snapshots', async ({ page }) => {
  await page.goto('/es/analisis/el-peso-del-silencio');
  await expect(page.getByRole('img', { name: 'Un pixel de ejemplo' })).toBeVisible();
  await expect(page.locator('a[href^="javascript:"], a[href^="data:"]')).toHaveCount(0);
});
