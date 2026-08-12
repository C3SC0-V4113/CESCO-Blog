import { getActionContext } from 'astro:actions';
import { middleware } from 'astro:i18n';
import { defineMiddleware } from 'astro:middleware';

import { drainBody } from '@/lib/request-body';

const localizedRouting = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: true,
  fallbackType: 'redirect',
});
/**
 * Preserve public i18n routing while enforcing the admin action entry-point
 * invariant. Cloudflare Access remains the external identity boundary.
 */
export const onRequest = defineMiddleware((context, next) => {
  const action = getActionContext(context).action;
  if (action?.calledFrom === 'form' && action.name.startsWith('admin.'))
    return drainBody(
      context.request.body,
      Number(context.request.headers.get('content-length'))
    ).then(() => new Response(null, { status: 403 })) as Promise<Response>;
  const isAdminRoute =
    context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/');
  const isAdminAction = context.url.pathname.startsWith('/_actions/admin.');

  return (
    isAdminRoute || isAdminAction ? next() : localizedRouting(context, next)
  ) as Promise<Response>;
});
