import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_CONFIG = 'dist/server/wrangler.production.json';
const ASTRO_CONFIG = 'dist/server/wrangler.json';
const REQUIRED_SECRET = 'CLOUDFLARE_CACHE_PURGE_TOKEN';
const hexId = /^[0-9a-f]{32}$/i;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accessTeamDomain = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const accessAudience = /^[0-9a-f]{64}$/i;

type Settings = ReturnType<typeof productionSettings>;
type Dependencies = {
  readBuildConfig(): Promise<Record<string, unknown>>;
  writeConfig(path: string, contents: string): void | Promise<void>;
  runWrangler(args: string[]): Promise<string>;
};

function required(environment: Record<string, string | undefined>, name: string, pattern: RegExp) {
  const value = environment[name]?.trim() ?? '';
  if (!pattern.test(value) || /^0+$/.test(value.replaceAll('-', '')))
    throw Error(`Invalid ${name}`);
  return value;
}

export function productionSettings(environment: Record<string, string | undefined>) {
  const bucket = environment.CLOUDFLARE_R2_BUCKET_NAME?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
    throw Error('Invalid CLOUDFLARE_R2_BUCKET_NAME');
  // A bare hostname: the Worker builds the token issuer as `https://<domain>`
  // (ADR-0039), so a scheme or path here could never match a real token.
  const teamDomain = environment.ACCESS_TEAM_DOMAIN?.trim().toLowerCase() ?? '';
  if (!accessTeamDomain.test(teamDomain)) throw Error('Invalid ACCESS_TEAM_DOMAIN');
  return {
    accountId: required(environment, 'CLOUDFLARE_ACCOUNT_ID', hexId),
    databaseId: required(environment, 'CLOUDFLARE_D1_DATABASE_ID', uuid),
    namespaceId: required(environment, 'CLOUDFLARE_KV_NAMESPACE_ID', hexId),
    zoneId: required(environment, 'CLOUDFLARE_ZONE_ID', hexId),
    bucket,
    accessTeamDomain: teamDomain,
    accessAudience: required(environment, 'ACCESS_AUD', accessAudience),
  };
}

export function buildProductionConfig(settings: Settings, astroConfig: Record<string, unknown>) {
  const config = structuredClone(astroConfig);
  delete config.configPath;
  delete config.userConfigPath;
  Object.assign(config, {
    account_id: settings.accountId,
    // Replaces the local block wholesale, so every var wrangler.jsonc declares
    // needs its production value here; a missing Access var answers 503 on
    // every admin request (ADR-0039).
    vars: {
      CACHE_PURGE_MODE: 'cloudflare',
      CLOUDFLARE_ZONE_ID: settings.zoneId,
      ACCESS_MODE: 'cloudflare',
      ACCESS_TEAM_DOMAIN: settings.accessTeamDomain,
      ACCESS_AUD: settings.accessAudience,
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'cesco-blog',
        database_id: settings.databaseId,
        migrations_dir: '../../drizzle',
      },
    ],
    r2_buckets: [{ binding: 'BUCKET', bucket_name: settings.bucket }],
    kv_namespaces: [{ binding: 'SESSION', id: settings.namespaceId }],
  });
  return `${JSON.stringify(config, null, 2)}\n`;
}

function remoteHasRequiredSecret(output: string) {
  let secrets: unknown;
  try {
    secrets = JSON.parse(output);
  } catch {
    throw Error('Wrangler returned an invalid secret list');
  }
  return (
    Array.isArray(secrets) &&
    secrets.some(
      (secret) =>
        secret && typeof secret === 'object' && 'name' in secret && secret.name === REQUIRED_SECRET
    )
  );
}

const runWrangler = (args: string[]) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'wrangler', ...args],
      { encoding: 'utf8' },
      (error, stdout, stderr) =>
        error ? reject(Error(stderr.trim() || error.message)) : resolve(stdout)
    );
  });

export async function deployProduction(
  environment: Record<string, string | undefined>,
  dependencies: Dependencies = {
    readBuildConfig: async () => JSON.parse(await readFile(ASTRO_CONFIG, 'utf8')),
    writeConfig: (path, contents) => writeFile(path, contents, 'utf8'),
    runWrangler,
  }
) {
  const config = buildProductionConfig(
    productionSettings(environment),
    await dependencies.readBuildConfig()
  );
  await dependencies.writeConfig(PRODUCTION_CONFIG, config);
  const secrets = await dependencies.runWrangler([
    'secret',
    'list',
    '--config',
    PRODUCTION_CONFIG,
    '--format',
    'json',
  ]);
  if (!remoteHasRequiredSecret(secrets)) throw Error(`Missing remote secret ${REQUIRED_SECRET}`);
  await dependencies.runWrangler([
    'd1',
    'migrations',
    'apply',
    'cesco-blog',
    '--remote',
    '--config',
    PRODUCTION_CONFIG,
  ]);
  await dependencies.runWrangler(['deploy', '--config', PRODUCTION_CONFIG]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const operation = process.argv.includes('--config-only')
    ? readFile(ASTRO_CONFIG, 'utf8').then((source) =>
        writeFile(
          PRODUCTION_CONFIG,
          buildProductionConfig(productionSettings(process.env), JSON.parse(source)),
          'utf8'
        )
      )
    : deployProduction(process.env);
  operation.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
