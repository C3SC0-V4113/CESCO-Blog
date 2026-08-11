import rss from '@astrojs/rss';

import { listFeedItems } from '@/db/queries/distribution';
import { getTranslations } from '@/i18n/utils';
import { cacheTagHeader } from '@/lib/cache-tags';
import { feedItemIdentity } from '@/lib/feed';
import { getDb } from '@/lib/runtime';
import { absolute } from '@/lib/seo';
import { SITE_NAME } from '@/lib/site';
import { fromDbTimestamp } from '@/lib/timestamps';
import { articlePath } from '@/lib/urls';

import type { APIRoute } from 'astro';

/**
 * English feed (ADR-0014).
 *
 * An SSR endpoint rather than a build-time file: the site publishes from D1 and
 * nothing rebuilds when a post goes live, so a generated feed would freeze at
 * whatever existed when the build ran.
 */
export const GET: APIRoute = async (context) => {
  const locale = 'en';
  const t = getTranslations(locale);
  const site = context.site?.toString() ?? context.url.origin;

  const items = await listFeedItems(getDb(), locale, 20);

  const response = await rss({
    title: SITE_NAME,
    description: t('listing.latest'),
    site,
    // `link` is deliberately absent from each item: supplying it makes
    // @astrojs/rss emit a URL-based guid, which ADR-0014 forbids. Both elements
    // come through customData instead — see src/lib/feed.ts.
    items: items.map((item) => ({
      title: item.title,
      description: item.excerpt ?? '',
      pubDate: fromDbTimestamp(item.publishedAt),
      customData: feedItemIdentity(
        absolute(site, articlePath(locale, item.section, item.slug)),
        item.localizationId
      ),
    })),
  });

  response.headers.set('Cache-Tag', cacheTagHeader(['rss', `locale-${locale}`]));
  return response;
};
