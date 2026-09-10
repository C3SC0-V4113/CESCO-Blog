import { describe, expect, it } from 'vitest';

import {
  cacheTagHeader,
  chunkPurgeTags,
  fullListingTags,
  homeTags,
  PURGE_TAGS_PER_REQUEST,
  postDetailTags,
  sectionListingTags,
} from '@/lib/cache-tags';

/**
 * ADR-0011's tag vocabulary.
 *
 * The cross-locale property is the one worth pinning: it is what makes
 * publishing one language refresh the other's `hreflang` without anyone
 * enumerating the pages involved.
 */

describe('postDetailTags', () => {
  it('tags both locales of a post identically on the post id', () => {
    // The aggregate id, not the localization id — so purging either language
    // reaches both detail pages.
    const spanish = postDetailTags('post-1', 'es', 'analysis');
    const english = postDetailTags('post-1', 'en', 'analysis');

    expect(spanish).toContain('post-post-1');
    expect(english).toContain('post-post-1');
    expect(spanish).not.toEqual(english);
  });

  it('carries the locale and section as separate dependencies', () => {
    expect(postDetailTags('abc', 'es', 'opinion')).toEqual([
      'post-abc',
      'locale-es',
      'section-opinion',
    ]);
  });
});

describe('listing tags', () => {
  it('scopes a section listing to its section and locale', () => {
    expect(sectionListingTags('en', 'analysis')).toEqual(['section-analysis', 'locale-en']);
  });

  it('marks the home as depending on the featured slot', () => {
    expect(homeTags('es')).toEqual(['locale-es', 'featured']);
  });

  it('scopes the full listing to the locale alone', () => {
    // It shows every section, so a section tag would be a lie about what it
    // depends on.
    expect(fullListingTags('es')).toEqual(['locale-es']);
  });
});

describe('cacheTagHeader', () => {
  it('joins with commas, which is what Cloudflare parses', () => {
    expect(cacheTagHeader(['a', 'b'])).toBe('a,b');
  });

  it('drops duplicates so composed sets do not spend the budget twice', () => {
    expect(cacheTagHeader(['locale-es', 'featured', 'locale-es'])).toBe('locale-es,featured');
  });
});

describe('chunkPurgeTags', () => {
  it('keeps each purge request within the per-request tag limit', () => {
    const tags = Array.from({ length: 65 }, (_, index) => `post-${index}`);
    const chunks = chunkPurgeTags(tags);

    expect(PURGE_TAGS_PER_REQUEST).toBe(30);
    expect(chunks.map((chunk) => chunk.length)).toEqual([30, 30, 5]);
    expect(chunks.flat()).toEqual(tags);
  });

  it('sends a tag once even when several pending changes share it', () => {
    expect(chunkPurgeTags(['post-1', 'rss', 'post-2', 'rss', 'post-1'])).toEqual([
      ['post-1', 'rss', 'post-2'],
    ]);
  });

  it('asks for no request when there is nothing to purge', () => {
    expect(chunkPurgeTags([])).toEqual([]);
  });
});
