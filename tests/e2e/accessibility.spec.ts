import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility and motion checks over the surfaces a reader and an
 * editor actually use (ADR-0022, ADR-0030, DESIGN.md).
 *
 * axe runs against the built Worker in both themes, because the two palettes
 * are separate sets of contrast pairs: a token that clears 4.5:1 in light says
 * nothing about its dark value. The rule set is WCAG 2.2 AA, the level the
 * design system claims. A violation here is fixed in source, never silenced by
 * disabling a rule.
 *
 * axe does not prove a page accessible. It catches the regressions that are
 * cheap to catch mechanically (contrast, names, landmarks, ARIA misuse), which
 * leaves the specs beside this one free to assert behaviour.
 */

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Seeded fixtures (scripts/seed.ts), the same ones the other specs read.
const POST = 'c1d4e7f0-3a29-4b6c-8d5e-2f7a9b0c1d34';
const ES_LOCALIZATION = '4f8b1c2d-5e6a-4079-8b1c-2d3e4f5a6b7c';

const PUBLIC_PAGES = [
  { name: 'Spanish home', path: '/es/' },
  { name: 'English home', path: '/en/' },
  { name: 'Spanish article', path: '/es/analisis/el-peso-del-silencio' },
  { name: 'English article', path: '/en/analysis/the-weight-of-silence' },
  { name: 'analysis listing', path: '/es/analisis' },
  { name: 'opinion listing', path: '/en/opinion' },
  { name: 'series index', path: '/es/series' },
  { name: 'tag page', path: '/es/etiquetas/diseno-sonoro' },
  { name: 'not found page', path: '/es/analisis/no-existe' },
];

const ADMIN_PAGES = [
  { name: 'posts list', path: '/admin/posts' },
  { name: 'editor', path: `/admin/posts/${POST}/edit?localization=${ES_LOCALIZATION}` },
  { name: 'SEO screen', path: `/admin/posts/${POST}/seo?localization=${ES_LOCALIZATION}` },
  { name: 'review queue', path: '/admin/review' },
  { name: 'media library', path: '/admin/media' },
  { name: 'series', path: '/admin/collections' },
  { name: 'authors', path: '/admin/authors' },
];

// Astro drops `ssr` from an island once it hydrates. The admin is inert until
// then, and axe skips inert content, so auditing earlier would pass a screen
// nobody can use yet.
const hydrated = (page: Page) => expect(page.locator('astro-island[ssr]')).toHaveCount(0);

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();

  // Reduced to what a failure needs to be read: which rule, and where.
  return violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
}

// The class the theme script leaves on <html> for each scheme. Light is the
// absence of `dark` rather than a class of its own.
const THEMES = [
  { colorScheme: 'light', themeClass: /^(?!.*\bdark\b)/ },
  { colorScheme: 'dark', themeClass: /\bdark\b/ },
] as const;

for (const { colorScheme, themeClass } of THEMES) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const { name, path } of [...PUBLIC_PAGES, ...ADMIN_PAGES]) {
      test(`the ${name} has no WCAG 2.2 AA violations`, async ({ page }) => {
        await page.goto(path);
        await hydrated(page);

        // The theme script reads the preference before paint. Asserting it took
        // keeps the dark half of this suite from silently auditing light twice.
        await expect(page.locator('html')).toHaveClass(themeClass);

        expect(await audit(page)).toEqual([]);
      });
    }
  });
}

test.describe('press feedback', () => {
  test.use({ colorScheme: 'light' });

  test('scales a pressed button to the press token', async ({ page }) => {
    await page.goto('/es/');

    // The theme toggle is the Button primitive every public control shares.
    const button = page.getByRole('button', { name: 'Cambiar tema' });
    await expect(button).toHaveClass(/active:not-aria-\[haspopup\]:scale-press/);
    await expect(button).toHaveCSS('transition-property', /scale/);

    // Held down rather than clicked, so `:active` lasts long enough to read.
    // `toHaveCSS` retries, so the 150 ms transition settles before it compares.
    // Both axes carry the token, and engines differ on whether they collapse
    // `0.96 0.96` to one value when serializing it.
    await button.hover();
    await page.mouse.down();
    await expect(button).toHaveCSS('scale', /^0\.96( 0\.96)?$/);
    await page.mouse.up();
  });
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' }, colorScheme: 'light' });

  test('presses a button without a transition', async ({ page }) => {
    await page.goto('/es/');

    await expect(page.getByRole('button', { name: 'Cambiar tema' })).toHaveCSS(
      'transition-property',
      'none'
    );
  });

  test('opens the language menu without animating it', async ({ page }) => {
    await page.goto('/es/');

    // Retried as a unit: the switcher hydrates on `client:idle`, and a click
    // that lands first does nothing (see chrome.spec.ts).
    const menu = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(async () => {
      await page.getByRole('button', { name: 'Cambiar idioma' }).click();
      await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass();

    await expect(menu).toHaveCSS('transition-property', 'none');
    expect(await menu.evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test.describe('narrow screens', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('opens the section sheet without sliding it in', async ({ page }) => {
      await page.goto('/es/');

      const sheet = page.getByRole('dialog');
      await expect(async () => {
        await page.getByRole('button', { name: 'Menú' }).click();
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      }).toPass();

      const overlay = page.locator('[data-slot="sheet-overlay"]');
      for (const surface of [sheet, overlay]) {
        await expect(surface).toHaveCSS('transition-property', 'none');
        expect(await surface.evaluate((element) => element.getAnimations().length)).toBe(0);
      }
    });
  });
});

test.describe('motion on, for comparison', () => {
  // The reduced-motion checks above would pass just as well if nothing ever
  // animated. These pin the default, so an opt-out that spread to everyone is
  // caught as surely as one that went missing.
  test.use({ colorScheme: 'light' });

  test('animates the language menu', async ({ page }) => {
    await page.goto('/es/');

    const menu = page.locator('[data-slot="dropdown-menu-content"]');
    await expect(async () => {
      await page.getByRole('button', { name: 'Cambiar idioma' }).click();
      await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass();

    await expect(menu).toHaveCSS('transition-property', /scale/);
  });

  test.describe('narrow screens', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('slides the section sheet in', async ({ page }) => {
      await page.goto('/es/');

      const sheet = page.getByRole('dialog');
      await expect(async () => {
        await page.getByRole('button', { name: 'Menú' }).click();
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      }).toPass();

      await expect(sheet).toHaveCSS('transition-property', /translate/);
    });
  });
});

/**
 * Whether the next navigation runs a cross-document view transition, read from
 * the `pagereveal` event the new document fires: its `viewTransition` is the
 * transition the browser started on our behalf, or null when none ran.
 */
async function followWithViewTransition(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('pagereveal', (event) => {
      document.documentElement.dataset.viewTransition = String(
        (event as Event & { viewTransition: unknown }).viewTransition !== null
      );
    });
  });

  await page.goto('/es/');
  await page.getByRole('banner').getByRole('link', { name: 'Análisis', exact: true }).click();
  await expect(page).toHaveURL(/\/es\/analisis$/);

  return page.locator('html');
}

test.describe('cross-document view transitions', () => {
  // Chromium is the engine here that ships both `@view-transition` and the
  // `pagereveal` event. Elsewhere the rule is ignored and the navigation is an
  // ordinary one, which is the degradation ADR-0022 accepts, so there is
  // nothing to assert rather than something to retry.
  test.beforeEach(({ browserName }) => {
    // eslint-disable-next-line playwright/no-skipped-test -- conditional: only Chromium exposes the transition to observe.
    test.skip(browserName !== 'chromium', 'Needs @view-transition and pagereveal.');
  });

  test('cross-fades a link followed with motion on', async ({ page }) => {
    const html = await followWithViewTransition(page);
    await expect(html).toHaveAttribute('data-view-transition', 'true');
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('navigates without a transition', async ({ page }) => {
      const html = await followWithViewTransition(page);
      await expect(html).toHaveAttribute('data-view-transition', 'false');
    });
  });
});
