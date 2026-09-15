import { expect, test, type Page } from '@playwright/test';

/**
 * Taxonomy work checked where it lands: the public head, the home, the action
 * boundary and the series routes (ADR-0010, ADR-0012, ADR-0013, ADR-0015).
 */

const SEEDED_COLLECTION = '7e1a4b2c-9d3f-4058-8a1b-6c7d8e9f0a1b';
const SEEDED_COLLECTION_ES = '8f2b5c3d-0e4a-4169-9b2c-7d8e9f0a1b2c';
const SEEDED_SLUG = 'el-sonido-en-los-juegos';
// The seeded membership, so a regression that let the call through would
// rewrite the series to what it already is rather than empty it.
const SEEDED_MEMBERS = [
  'c1d4e7f0-3a29-4b6c-8d5e-2f7a9b0c1d34',
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000005',
];

const actionResponse = (page: Page, name: string) =>
  page.waitForResponse((response) => response.url().includes(`/_actions/admin.${name}`));

// Astro drops `ssr` from an island once it hydrates; a click before that is lost.
const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);

/**
 * A post of its own, published through the screens an editor uses, so nothing
 * here races the seed or another browser. The cover is the one field publishing
 * requires beyond a title (ADR-0015), and it lives on the SEO screen.
 */
// Every post published here is withdrawn afterwards. They land in the shared
// local database, and a few runs of published fixtures would push the seeded
// article off the home page and out of the feeds that other specs read.
const publishedHere: Array<{ postId: string; localizationId: string }> = [];

test.afterEach(async ({ request }) => {
  for (const localization of publishedHere.splice(0)) {
    const response = await request.post('/_actions/admin.unpublish', {
      data: localization,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok()).toBe(true);
  }
});

async function publishNewPost(page: Page) {
  const slug = `taxonomia-${crypto.randomUUID()}`;
  const title = `Publicación ${slug}`;
  await page.goto('/admin/posts/new');
  await hydrated(page);
  await page.getByLabel('Slug').fill(slug);
  await page.getByRole('button', { name: 'Crear publicación' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  const href = await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: slug }) })
    .getByRole('link', { name: 'Borrador' })
    .getAttribute('href');
  const match = /^\/admin\/posts\/([^/]+)\/edit\?localization=([^&]+)$/.exec(href ?? '');
  expect(match).toBeTruthy();
  const [, postId, localizationId] = match!;

  await page.goto(href!);
  await hydrated(page);
  const drafted = actionResponse(page, 'saveDraft');
  await page.getByLabel('Título').fill(title);
  expect((await drafted).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Guardado');

  await page.goto(`/admin/posts/${postId}/seo?localization=${localizationId}`);
  await hydrated(page);
  await page.getByLabel('Portada editorial limpia').selectOption({ index: 1 });
  const covered = actionResponse(page, 'saveSeoDraft');
  await page.getByRole('button', { name: 'Guardar' }).click();
  expect((await covered).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Cambios guardados.');

  await page.goto(`/admin/review?post=${postId}&localization=${localizationId}`);
  await hydrated(page);
  const published = actionResponse(page, 'publish');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  expect((await published).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Publicar nueva revisión' })).toBeVisible();
  publishedHere.push({ postId: postId!, localizationId: localizationId! });
  return { postId: postId!, localizationId: localizationId!, slug, title };
}

test('an SEO title reaches the public head only once review publishes it', async ({ page }) => {
  const post = await publishNewPost(page);
  const article = `/es/analisis/${post.slug}`;
  const ogTitle = page.locator('meta[property="og:title"]');
  const seoTitle = `Título SEO ${post.slug}`;
  const socialTitle = `Título social ${post.slug}`;

  await page.goto(article);
  await expect(page).toHaveTitle(post.title);
  await expect(ogTitle).toHaveAttribute('content', post.title);

  await page.goto(`/admin/posts/${post.postId}/seo?localization=${post.localizationId}`);
  await hydrated(page);
  await page.getByLabel('Título SEO').fill(seoTitle);
  await page.getByLabel('Título de Open Graph').fill(socialTitle);
  const saved = actionResponse(page, 'saveSeoDraft');
  await page.getByRole('button', { name: 'Guardar' }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Cambios guardados.');

  // Saved to the draft, so the live page keeps its published revision.
  await page.goto(article);
  await expect(page).toHaveTitle(post.title);
  await expect(ogTitle).toHaveAttribute('content', post.title);

  await page.goto(`/admin/review?post=${post.postId}&localization=${post.localizationId}`);
  await hydrated(page);
  const republished = actionResponse(page, 'publish');
  // A successful publish reloads the review page to show the server state;
  // leaving before that reload lands races the app's own navigation.
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Publicar nueva revisión' }).click();
  expect((await republished).status()).toBe(200);
  await reloaded;

  await page.goto(article);
  await expect(page).toHaveTitle(seoTitle);
  await expect(ogTitle).toHaveAttribute('content', socialTitle);
  // Head metadata only: the article still leads with its editorial title.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(post.title);
});

test('featuring a post fills the home slot without repeating it below', async ({
  page,
}, testInfo) => {
  // One slot per locale, shared by every browser project running at once.
  // eslint-disable-next-line playwright/no-skipped-test -- conditional: a second project would race this one for the slot.
  test.skip(testInfo.project.name !== 'chromium', 'The featured slot is global state.');
  const post = await publishNewPost(page);
  const toggle = async (from: string, to: string) => {
    await page.goto('/admin/posts');
    await hydrated(page);
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: post.title }) });
    const changed = actionResponse(page, 'setFeatured');
    await row.getByRole('button', { name: from }).click();
    expect((await changed).status()).toBe(200);
    await expect(row.getByRole('button', { name: to })).toBeVisible();
  };

  await toggle('Destacar', 'Quitar destacado');
  try {
    await page.goto('/es/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(['Lo último']);
    const slot = page.getByRole('region', { name: 'Destacado' });
    await expect(slot.getByRole('link', { name: post.title })).toHaveAttribute(
      'href',
      `/es/analisis/${post.slug}`
    );
    // Once on the page, not once in the slot and again in the latest list.
    await expect(page.getByRole('link', { name: post.title })).toHaveCount(1);
  } finally {
    await toggle('Quitar destacado', 'Destacar');
  }
});

test('a published series keeps its slug in the editor and at the action', async ({ page }) => {
  await page.goto(`/admin/collections/${SEEDED_COLLECTION}`);
  await hydrated(page);
  const spanish = page.getByRole('group', { name: 'Español' });
  await expect(spanish.getByLabel('Slug')).toHaveValue(SEEDED_SLUG);
  await expect(spanish.getByLabel('Slug')).not.toBeEditable();
  await expect(
    spanish.getByText('El slug queda bloqueado después de la primera publicación.')
  ).toBeVisible();

  // The same rename, sent straight to the action the editor would call.
  const refused = await page.request.post('/_actions/admin.saveCollection', {
    data: {
      id: SEEDED_COLLECTION,
      editorialState: 'active',
      localizations: [
        {
          id: SEEDED_COLLECTION_ES,
          locale: 'es',
          slug: `renombrada-${crypto.randomUUID()}`,
          title: 'El sonido en los juegos',
          description: 'Una serie sobre cómo suenan —y cómo callan— los mundos que jugamos.',
          status: 'published',
        },
      ],
      postIds: SEEDED_MEMBERS,
    },
  });
  expect(refused.status()).toBe(409);
  expect(await refused.text()).toContain('collection-slug-locked');

  // Readers still find the series where they always have.
  expect((await page.request.get(`/es/series/${SEEDED_SLUG}`)).status()).toBe(200);
  await page.reload();
  await expect(spanish.getByLabel('Slug')).toHaveValue(SEEDED_SLUG);
});

test('creates a series in Spanish alone and serves it only in Spanish', async ({ page }) => {
  const slug = `solo-espanol-${crypto.randomUUID()}`;
  const title = `Serie en español ${slug}`;
  await page.goto('/admin/collections');
  await hydrated(page);
  const created = actionResponse(page, 'createCollection');
  await page.getByRole('button', { name: 'Nueva serie' }).click();
  expect((await created).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/collections\/[0-9a-f-]{36}$/);
  await hydrated(page);

  const spanish = page.getByRole('group', { name: 'Español' });
  const english = page.getByRole('group', { name: 'English' });
  await spanish.getByLabel('Título').fill(title);
  await spanish.getByLabel('Slug').fill(slug);
  await spanish.getByLabel('Estado de publicación').selectOption('published');
  const saved = actionResponse(page, 'saveCollection');
  await page.getByRole('button', { name: 'Guardar' }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Cambios guardados.');

  await page.reload();
  await expect(spanish.getByLabel('Título')).toHaveValue(title);
  await expect(spanish.getByLabel('Slug')).not.toBeEditable();
  await expect(english.getByLabel('Título')).toHaveValue('');
  await expect(english.getByLabel('Slug')).toHaveValue('');

  await page.goto(`/es/series/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  expect((await page.request.get(`/en/series/${slug}`)).status()).toBe(404);
});
