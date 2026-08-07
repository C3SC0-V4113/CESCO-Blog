import { describe, expect, it } from 'vitest';

import { escapeXml, feedItemIdentity } from '@/lib/feed';

/**
 * These two elements are escaped by us rather than by `@astrojs/rss`, because
 * they are injected as raw `customData` — see the module comment for why.
 * Anything the library would have escaped for us has to be escaped here.
 */

describe('escapeXml', () => {
  it('escapes every character that can break an element body', () => {
    expect(escapeXml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
  });

  it('escapes ampersands first so entities are not double-encoded wrongly', () => {
    expect(escapeXml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

describe('feedItemIdentity', () => {
  it('marks the guid as not a permalink', () => {
    // The whole point: readers treat it as an opaque id, so the address can
    // change without the article arriving again as new (ADR-0014).
    const xml = feedItemIdentity('https://example.com/es/analisis/x', 'loc-1');

    expect(xml).toContain('<guid isPermaLink="false">loc-1</guid>');
  });

  it('keeps the current address in the link', () => {
    const xml = feedItemIdentity('https://example.com/es/analisis/x', 'loc-1');

    expect(xml).toContain('<link>https://example.com/es/analisis/x</link>');
  });

  it('escapes a query string rather than breaking the document', () => {
    const xml = feedItemIdentity('https://example.com/x?a=1&b=2', 'loc-1');

    expect(xml).toContain('a=1&amp;b=2');
  });
});
