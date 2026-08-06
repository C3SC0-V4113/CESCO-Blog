import type { APIRoute } from 'astro';

/**
 * `robots.txt` (ADR-0014).
 *
 * An endpoint rather than a static file so the sitemap URL is derived from the
 * deployed origin instead of hardcoded, which keeps preview deployments from
 * advertising the production sitemap.
 */
export const GET: APIRoute = (context) => {
  const site = context.site?.toString().replace(/\/$/, '') ?? context.url.origin;

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
