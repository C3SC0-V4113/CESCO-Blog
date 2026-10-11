/** Wrangler arguments shared by the local seed and the disposable e2e setup. */
export function persistToArgs(persistTo: string): string[] {
  return persistTo ? ['--persist-to', persistTo] : [];
}

export function d1SeedArgs(persistTo: string): string[] {
  return [
    'd1',
    'execute',
    'cesco-blog',
    '--local',
    '--file=.wrangler/seed.sql',
    ...persistToArgs(persistTo),
  ];
}

export function r2SeedArgs(key: string, file: string, persistTo: string): string[] {
  return [
    'r2',
    'object',
    'put',
    `cesco-blog-media/${key}`,
    `--file=${file}`,
    '--content-type=image/png',
    '--local',
    ...persistToArgs(persistTo),
  ];
}

/** Quote one argument for the generated POSIX seed script. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
