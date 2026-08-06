import { defineConfig, devices } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Both numbers are caps, and they cap different things.
  //
  // On CI, one. Two would be safe on paper: the suite only reads, and it runs
  // against the built Worker rather than a Vite dev server. In practice a
  // WebKit job reproducibly killed its own server — every request after the
  // first few answered "connection refused", with wrangler logging an empty
  // error before dying. Two WebKit instances plus node plus workerd on a 4 GB
  // runner is the likeliest cause, though that is a mitigation rather than a
  // diagnosis. Parallelism comes from the browser matrix, which is unaffected.
  //
  // Locally, two — and the constraint is the server, not the runner. CI runs
  // one browser per job (`--project=<browser>` in the matrix), so it only ever
  // points one worker at one `wrangler dev`. Running `test:e2e` locally instead
  // starts all three projects against a *single* server, and left unbounded
  // Playwright sizes the pool from the CPU count: the browser matrix multiplies
  // clients, not servers. Past roughly 140 tests that server stops answering
  // mid-run and whole files fail on `page.goto` timeouts.
  //
  // Two is not a guess. On the taxonomy branch each project passed alone (49,
  // 49 and 49) while the combined unbounded run took 6.5 minutes and finished
  // either with 38 timeouts or with a worker that never exited. The same 147
  // tests at two workers pass in 82 seconds. The cap is five times faster *and*
  // correct, which is the tell that contention was the cost all along.
  workers: process.env.CI ? 1 : 2,
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
