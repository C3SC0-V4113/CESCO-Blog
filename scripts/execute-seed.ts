import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { d1SeedArgs } from './seed-commands.ts';

const wranglerCli = path.resolve('node_modules/wrangler/bin/wrangler.js');
const result = spawnSync(
  process.execPath,
  [wranglerCli, ...d1SeedArgs(process.env.SEED_PERSIST_TO ?? '')],
  {
    stdio: 'inherit',
  }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
