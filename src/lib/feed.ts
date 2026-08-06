/**
 * RSS item assembly (ADR-0014).
 *
 * ## Why the item is built this way
 *
 * ADR-0014 mandates `@astrojs/rss` and, separately, mandates a `guid` that is
 * the **stable localization id** with `isPermaLink="false"` — never the URL,
 * because slugs are mutable and a renamed post would arrive in every
 * subscriber's reader as though it were new.
 *
 * Those two requirements conflict. `@astrojs/rss` emits
 * `<guid isPermaLink="true">` from the item link unconditionally whenever
 * `link` is a string, and exposes no way to override it.
 *
 * So the item omits `link` — which is the only thing that triggers the
 * library's `guid` — and supplies both elements through `customData`. The
 * library keeps doing everything else: the channel envelope, `atom:link`, date
 * formatting and escaping of the title and description.
 *
 * The cost is that these two elements are escaped here rather than by the
 * library, which is what `escapeXml` is for.
 */

/** Escapes text for an XML element body. */
export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * The `<link>` and `<guid>` pair for one item.
 *
 * `isPermaLink="false"` is the part that matters: it tells readers the value is
 * an opaque identifier rather than an address, which is what lets the address
 * change without the identity changing with it.
 */
export function feedItemIdentity(canonicalUrl: string, localizationId: string): string {
  return `<link>${escapeXml(canonicalUrl)}</link><guid isPermaLink="false">${escapeXml(
    localizationId
  )}</guid>`;
}
