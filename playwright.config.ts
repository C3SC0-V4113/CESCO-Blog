import { defineConfig, devices } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Deliberately one worker on CI, even though this suite is read-only and has
  // no data to collide over. The tests run against `astro dev`, and a Vite dev
  // server can invalidate modules mid-run when several workers hit it at once.
  // CI parallelism comes from the workflow instead: one job per browser, run
  // side by side. Pointing the suite at a production build — `astro build` plus
  // `wrangler dev` — would remove the hazard and make the zero-JS guard measure
  // real output, and is the change that would unlock more workers here.
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // On Windows the WebKit process intermittently fails to exit and
    // Playwright's worker watchdog force-kills it, failing the run with
    // "worker-N process did not exit within 300000ms after stop". It is an
    // upstream race (microsoft/playwright#40637, new in 1.60), not a suite
    // problem: identical runs pass and fail, and the tests themselves have
    // already reported green when it fires. CI runs on Linux and is unaffected.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Not `webServer`: Astro 7's dev command daemonizes and returns immediately,
  // which Playwright reads as the server having died. See tests/e2e/global-setup.ts.
  globalSetup: './tests/e2e/global-setup.ts',
});
