import { listSitemapEntries } from '@/db/queries/distribution';
import { locales } from '@/i18n/locales';
import { cacheTagHeader } from '@/lib/cache-tags';
import { escapeXml } from '@/lib/feed';
import { getDb } from '@/lib/runtime';
import { absolute } from '@/lib/seo';
import { fromDbTimestamp } from '@/lib/timestamps';
import { articlePath, sectionPath } from '@/lib/urls';

import type { APIRoute } from 'astro';

/**
 * Sitemap (ADR-0014).
 *
 * Not `@astrojs/sitemap`: that generates at build time from routes known to the
 * build, and every post URL here lives in D1 and does not exist until a request
 * arrives. A generated sitemap would list the home page and nothing else.
 *
 * `lastmod` comes from the published revision's `created_at` — the same source
 * ADR-0013 requires for JSON-LD `dateModified`, so the sitemap cannot disagree
 * with the page it describes. An integration test asserts they match.
 *
 * One joined query, because a per-post read would start failing outright once
 * the archive passed fifty entries (ADR-0016).
 */
export const GET: APIRoute = async (context) => {
  const site = context.site?.toString() ?? context.url.origin;
  const entries = await listSitemapEntries(getDb());

  const urls = [
    // The listing surfaces, which exist as routes rather than as rows.
    ...locales.flatMap((locale) => [
      { loc: absolute(site, `/${locale}/`), lastmod: null },
      { loc: absolute(site, `/${locale}/blog`), lastmod: null },
      { loc: absolute(site, sectionPath(locale, 'analysis')), lastmod: null },
      { loc: absolute(site, sectionPath(locale, 'opinion')), lastmod: null },
    ]),
    ...entries.map((entry) => ({
      loc: absolute(site, articlePath(entry.locale, entry.section, entry.slug)),
      lastmod: entry.lastModified,
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url><loc>${escapeXml(url.loc)}</loc>${
        url.lastmod ? `<lastmod>${fromDbTimestamp(url.lastmod).toISOString()}</lastmod>` : ''
      }</url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Tag': cacheTagHeader(['sitemap']),
    },
  });
};
