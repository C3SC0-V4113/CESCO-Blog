import { defineConfig, devices } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Safe to parallelise: the suite only reads, and it now runs against the
  // built Worker rather than a Vite dev server, which was the thing that could
  // invalidate modules mid-run under concurrent load.
  //
  // Locally the number is a cap rather than a default, and the thing being
  // capped is clients per server. CI runs one browser per job
  // (`--project=<browser>` in the matrix), so it only ever points one worker at
  // one `wrangler dev`. Running `test:e2e` locally starts all three projects
  // against a *single* server, and left unbounded Playwright sizes the pool
  // from the CPU count — a number that describes this machine and not what one
  // workerd process can absorb.
  //
  // Two carried 147 tests in 82 seconds, so the bound costs nothing worth
  // having. It is deliberately not claimed as a fix for anything: one local run
  // did fail 38 tests on `page.goto` timeouts, but that run turned out to have
  // two stray `wrangler dev` processes fighting over the port, so it is not
  // evidence of contention. The bound is here because unbounded clients against
  // one server is the wrong default, not because it repaired a measured fault.
  workers: 2,
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
