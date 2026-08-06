import { defineConfig, devices } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker on CI, two would be safe on paper: the suite only reads, and it
  // runs against the built Worker rather than a Vite dev server. In practice a
  // WebKit job reproducibly killed its own server — every request after the
  // first few answered "connection refused", with wrangler logging an empty
  // error before dying. Two WebKit instances plus node plus workerd on a 4 GB
  // runner is the likeliest cause, though that is a mitigation rather than a
  // diagnosis. Parallelism comes from the browser matrix, which is unaffected.
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
  webServer: {
    // The end-to-end suite exercises the **built Worker**, not `astro dev`.
    //
    // Three things follow from that. The zero-JS guard can assert on real
    // output — a dev server injects its own HMR client and serves component
    // styles as JS modules, so "this page ships no JavaScript" was not
    // measurable there. Workers can run in parallel, because there is no Vite
    // optimizer to invalidate modules mid-run. And `astro dev`'s daemonising,
    // which made `webServer` unusable and needed a whole global-setup file to
    // work around, stops mattering: `wrangler dev` stays in the foreground.
    //
    // The database is prepared by the same command so ordering is guaranteed
    // and nothing else holds the local SQLite file open. Both steps are
    // idempotent, so the suite runs from a clean checkout with no manual setup.
    command: 'pnpm run e2e:serve',
    url: baseUrl,
    // Never reuse a server someone left running: it may be an `astro dev` on
    // this port, serving unbuilt output, and the suite would quietly stop
    // testing what it claims to test.
    reuseExistingServer: false,
    // Covers migrations, seed, a cold `astro build` and the Worker booting, on
    // a CI runner slower than a dev machine. Overshooting costs nothing on a
    // run that was going to succeed.
    timeout: 240_000,
  },
});
