interface CloudflareProjectEnv extends Env {
  /** Wrangler secrets are intentionally absent from generated configuration types. */
  CLOUDFLARE_CACHE_PURGE_TOKEN?: string;
}
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare namespace Cloudflare {
  interface Env extends CloudflareProjectEnv {}
}
