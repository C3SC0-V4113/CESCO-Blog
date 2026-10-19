import { env } from 'cloudflare:workers';

import type { PurgeTags } from '@/actions/publishing';

type PurgeConfig = {
  mode: string;
  zoneId: string;
  token: string;
};

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function makeCachePurger(
  request: Request,
  config: PurgeConfig,
  fetcher: typeof fetch = fetch
): PurgeTags {
  if (config.mode === 'local') {
    if (!localHosts.has(new URL(request.url).hostname))
      throw Error('local-cache-purge-mode-outside-localhost');
    return async (tags) => {
      console.warn(JSON.stringify({ event: 'local-cache-purge', tags }));
    };
  }
  if (config.mode !== 'cloudflare' || !config.zoneId || !config.token)
    throw Error('cache-purge-not-configured');
  return async (tags) => {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.zoneId)}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      }
    );
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw Error(`cache-purge-failed:${response.status}`);
    }
    if (
      !response.ok ||
      typeof result !== 'object' ||
      result === null ||
      !Object.prototype.hasOwnProperty.call(result, 'success') ||
      (result as { success?: unknown }).success !== true
    )
      throw Error(`cache-purge-failed:${response.status}`);
  };
}

export function createCachePurger(request: Request): PurgeTags {
  return makeCachePurger(request, {
    // The checked-in config is intentionally local-only; production bindings
    // come from the generated config and therefore cannot be literal-inferred
    // by `wrangler types` from wrangler.jsonc.
    mode: String(env.CACHE_PURGE_MODE),
    zoneId: String(env.CLOUDFLARE_ZONE_ID),
    token: env.CLOUDFLARE_CACHE_PURGE_TOKEN ?? '',
  });
}
