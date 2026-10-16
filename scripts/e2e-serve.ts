import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { persistToArgs } from './seed-commands.ts';

const persistTo = '.wrangler/e2e';
const env = { ...process.env, SEED_PERSIST_TO: persistTo };
const wranglerCli = path.resolve('node_modules/wrangler/bin/wrangler.js');

rmSync(persistTo, { recursive: true, force: true });

function runNode(args: string[], commandEnv = env): void {
  const result = spawnSync(process.execPath, args, { env: commandEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNode([
  wranglerCli,
  'd1',
  'migrations',
  'apply',
  'cesco-blog',
  '--local',
  ...persistToArgs(persistTo),
]);
runNode(['--disable-warning=ExperimentalWarning', 'scripts/seed.ts']);
runNode(['scripts/execute-seed.ts']);

const upload = spawn('sh', ['.wrangler/seed-media.sh'], { env, stdio: 'inherit' });
upload.on('error', (error) => {
  throw error;
});
const uploadStatus = await new Promise<number | null>((resolve) => {
  upload.on('exit', (status) => resolve(status));
});
if (uploadStatus !== 0) process.exit(uploadStatus ?? 1);

runNode([
  wranglerCli,
  'd1',
  'execute',
  'cesco-blog',
  '--local',
  '--file=tests/fixtures/unsafe-legacy-snapshot.sql',
  ...persistToArgs(persistTo),
]);

runNode(['node_modules/astro/bin/astro.mjs', 'build']);

const worker = spawn(
  process.execPath,
  [
    wranglerCli,
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '3000',
    ...persistToArgs(persistTo),
  ],
  { env, stdio: 'inherit' }
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => worker.kill(signal));
}

const workerStatus = await new Promise<number | null>((resolve) => {
  worker.on('error', (error) => {
    console.error(error);
    resolve(1);
  });
  worker.on('exit', (status) => resolve(status));
});
process.exit(workerStatus ?? 0);
