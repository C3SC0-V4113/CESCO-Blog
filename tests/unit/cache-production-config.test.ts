import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildProductionConfig,
  deployProduction,
  productionSettings,
} from '../../scripts/deploy-production';

const validEnvironment = {
  CLOUDFLARE_ACCOUNT_ID: '11111111111111111111111111111111',
  CLOUDFLARE_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111',
  CLOUDFLARE_KV_NAMESPACE_ID: '22222222222222222222222222222222',
  CLOUDFLARE_ZONE_ID: '33333333333333333333333333333333',
  CLOUDFLARE_R2_BUCKET_NAME: 'cesco-blog-production-media',
};
const astroConfig = {
  name: 'cesco-blog',
  main: 'entry.mjs',
  no_bundle: true,
  assets: { binding: 'ASSETS', directory: '../client' },
  vars: { CACHE_PURGE_MODE: 'local', CLOUDFLARE_ZONE_ID: '' },
  d1_databases: [{ binding: 'DB', database_id: '0'.repeat(36) }],
  r2_buckets: [{ binding: 'BUCKET', bucket_name: 'cesco-blog-media' }],
  kv_namespaces: [{ binding: 'SESSION', id: '0'.repeat(32) }],
};

describe('production cache purge configuration', () => {
  it.each([
    ['CLOUDFLARE_ACCOUNT_ID', ''],
    ['CLOUDFLARE_ACCOUNT_ID', '00000000000000000000000000000000'],
    ['CLOUDFLARE_D1_DATABASE_ID', '00000000-0000-0000-0000-000000000000'],
    ['CLOUDFLARE_D1_DATABASE_ID', 'not-a-uuid'],
    ['CLOUDFLARE_KV_NAMESPACE_ID', '0'.repeat(32)],
    ['CLOUDFLARE_ZONE_ID', 'short'],
    ['CLOUDFLARE_R2_BUCKET_NAME', ''],
  ])('fails before deployment for invalid %s', (key, value) => {
    expect(() => productionSettings({ ...validEnvironment, [key]: value })).toThrow(key);
  });

  it('generates a complete production config without embedding the purge secret', () => {
    const config = JSON.parse(
      buildProductionConfig(productionSettings(validEnvironment), astroConfig)
    );
    expect(config).toMatchObject({
      account_id: validEnvironment.CLOUDFLARE_ACCOUNT_ID,
      vars: {
        CACHE_PURGE_MODE: 'cloudflare',
        CLOUDFLARE_ZONE_ID: validEnvironment.CLOUDFLARE_ZONE_ID,
      },
      d1_databases: [{ database_id: validEnvironment.CLOUDFLARE_D1_DATABASE_ID }],
      r2_buckets: [{ bucket_name: validEnvironment.CLOUDFLARE_R2_BUCKET_NAME }],
      kv_namespaces: [{ id: validEnvironment.CLOUDFLARE_KV_NAMESPACE_ID }],
      main: 'entry.mjs',
      no_bundle: true,
      assets: { directory: '../client' },
    });
    expect(JSON.stringify(config)).not.toContain('CLOUDFLARE_CACHE_PURGE_TOKEN');
  });

  it('verifies the remote secret before deploying through the generated config', async () => {
    const writes: [string, string][] = [];
    const calls: string[][] = [];
    await deployProduction(validEnvironment, {
      readBuildConfig: async () => astroConfig,
      writeConfig: (path, contents) => {
        writes.push([path, contents]);
      },
      runWrangler: async (args) => {
        calls.push(args);
        return args[0] === 'secret'
          ? JSON.stringify([{ name: 'CLOUDFLARE_CACHE_PURGE_TOKEN', type: 'secret_text' }])
          : '';
      },
    });
    expect(writes[0]?.[0]).toBe('dist/server/wrangler.production.json');
    expect(calls).toEqual([
      ['secret', 'list', '--config', 'dist/server/wrangler.production.json', '--format', 'json'],
      [
        'd1',
        'migrations',
        'apply',
        'cesco-blog',
        '--remote',
        '--config',
        'dist/server/wrangler.production.json',
      ],
      ['deploy', '--config', 'dist/server/wrangler.production.json'],
    ]);
  });

  it('fails closed when the remote purge secret is absent', async () => {
    await expect(
      deployProduction(validEnvironment, {
        readBuildConfig: async () => astroConfig,
        writeConfig: () => undefined,
        runWrangler: async () => '[]',
      })
    ).rejects.toThrow('CLOUDFLARE_CACHE_PURGE_TOKEN');
  });

  it('keeps local bindings explicit and production material ignored', () => {
    const config = readFileSync('wrangler.jsonc', 'utf8');
    expect(config).toContain('"CACHE_PURGE_MODE": "local"');
    expect(config).not.toContain('"production"');
    expect(readFileSync('.gitignore', 'utf8')).toContain('wrangler.production.json');
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['deploy:production']).toBe(
      'pnpm run build && node scripts/deploy-production.ts'
    );
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['config:production']).toBe(
      'pnpm run build && node scripts/deploy-production.ts --config-only'
    );
  });
});
