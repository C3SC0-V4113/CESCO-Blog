import { getActionContext } from 'astro:actions';
import { middleware } from 'astro:i18n';
import { defineMiddleware } from 'astro:middleware';
import { createRemoteJWKSet } from 'jose';

import { accessPolicy, verifyAccessJwt } from '@/lib/access';
import { classifyAdminRequest } from '@/lib/admin-boundary';
import { drainBody } from '@/lib/request-body';
import { getAccessConfig } from '@/lib/runtime';

const localizedRouting = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: true,
  fallbackType: 'redirect',
});

// One key set per isolate and team: jose caches the fetched keys inside it, so
// building one per request would refetch the certs on every admin call.
const teamKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function accessKeys(teamDomain: string) {
  let keys = teamKeys.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    teamKeys.set(teamDomain, keys);
  }
  return keys;
}

async function refuse(request: Request, status: 403 | 503) {
  await drainBody(request.body, Number(request.headers.get('content-length')));
  return new Response(null, { status });
}

/**
 * Admin pages and admin actions require a verified Cloudflare Access identity
 * (ADR-0039); the external path rule alone cannot prove it matches what Astro
 * routes. Everything else keeps the public locale routing.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const boundary = classifyAdminRequest({
    routePattern: context.routePattern,
    pathname: context.url.pathname,
    action: getActionContext(context).action,
  });
  if (boundary === 'reject') return refuse(context.request, 403);
  if (boundary === 'public') return localizedRouting(context, next) as Promise<Response>;

  const { mode, teamDomain, audience } = getAccessConfig();
  const policy = accessPolicy({ mode, teamDomain, audience, hostname: context.url.hostname });
  // The admin is language-neutral (ADR-0003), so it never enters locale routing.
  if (policy === 'local') return next();
  if (policy === 'misconfigured') {
    console.error(
      'Refusing admin request: Cloudflare Access needs ACCESS_MODE=cloudflare with ACCESS_TEAM_DOMAIN and ACCESS_AUD, or local mode on a loopback host (ADR-0039).'
    );
    return refuse(context.request, 503);
  }
  const token = context.request.headers.get('Cf-Access-Jwt-Assertion');
  const verified =
    token !== null &&
    (await verifyAccessJwt(token, accessKeys(teamDomain), { teamDomain, audience }));
  return verified ? next() : refuse(context.request, 403);
});
