import { expect, type Page } from '@playwright/test';

/** Wait for the admin document and its hydrated React island to be present. */
export async function waitForAdminHydration(page: Page) {
  // An empty locator also has count zero while a new document is still streaming.
  await expect(page.locator('astro-island')).toHaveCount(1);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
}
