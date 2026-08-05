import { spawnSync } from 'node:child_process';

/**
 * Starts the dev server for the end-to-end run.
 *
 * Playwright's `webServer` option cannot be used here. Astro 7's `astro dev`
 * always daemonizes: it starts the server, prints the URL, and the foreground
 * process exits 0. Playwright's `webServer` requires a command that stays in
 * the foreground for the whole run, so it reads that immediate exit as
 * "Process from config.webServer exited early" and gives up before a single
 * test runs.
 *
 * The supervisor is the supported way to drive it — `astro dev --background`
 * blocks until the server is ready, and `astro dev stop` shuts it down.
 */

const HOST = '127.0.0.1';
const PORT = 3000;

function astro(...args: string[]): string {
  const result = spawnSync('pnpm', ['exec', 'astro', ...args], {
    encoding: 'utf8',
    shell: true,
  });

  // The supervisor writes its status lines to either stream depending on level.
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

export default function globalSetup(): () => void {
  const status = astro('dev', 'status');
  const alreadyRunning = !status.includes('No dev server is running');

  if (alreadyRunning) {
    // Reuse it, but only if it is actually reachable at the URL the tests use.
    // A server left over on another port produces a wall of timeouts that says
    // nothing about why, which is a bad hour to hand anyone.
    if (!status.includes(`:${PORT}`)) {
      throw new Error(
        `A dev server is already running, but not on port ${PORT}:\n${status.trim()}\n` +
          `Stop it with \`pnpm exec astro dev stop\` and run the suite again.`
      );
    }

    // Someone else started it, so leave it running when the suite finishes.
    return () => {};
  }

  const startup = astro('dev', '--background', '--host', HOST, '--port', String(PORT));

  if (!startup.includes(`:${PORT}`)) {
    throw new Error(`Could not start the dev server on port ${PORT}:\n${startup.trim()}`);
  }

  return () => {
    astro('dev', 'stop');
  };
}
