/* eslint-disable @typescript-eslint/no-empty-object-type */
interface CloudflareProjectEnv extends Env {}
declare namespace Cloudflare {
  interface Env extends CloudflareProjectEnv {}
}
