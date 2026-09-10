import { middleware } from 'astro:i18n';
import { defineMiddleware } from 'astro:middleware';

const localizedRouting = middleware({
  prefixDefaultLocale: true,
  redirectToDefaultLocale: true,
  fallbackType: 'redirect',
});

/**
 * Keep Astro's established locale routing for public pages while exempting the
 * language-neutral admin application. Cloudflare Access remains the external
 * security boundary; this middleware changes routing only and authenticates
 * nothing.
 */
export const onRequest = defineMiddleware((context, next) => {
  const isAdminRoute =
    context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/');

  return isAdminRoute ? next() : localizedRouting(context, next);
});
