// Imports inside this directory carry the `.ts` extension on purpose. These
// modules are imported by `scripts/seed.ts`, which Node runs directly through
// native type stripping — and Node's ESM resolver neither infers extensions nor
// understands the `@/` alias. ADR-0017 requires the seed and the future admin to
// share this module rather than duplicate it, so it has to stay loadable from
// both runtimes.
import type { ContentBlock, ContentDoc } from './schema.ts';

/**
 * Derivation of the values persisted on `post_revisions` (ADR-0012).
 *
 * Both are computed once at publish time instead of per request. A revision is
 * immutable, so a value derived from it cannot drift from its source, and the
 * Worker does not spend its CPU budget reparsing rich text on every uncached
 * render (ADR-0016).
 *
 * ADR-0017 makes this the single implementation: the seed script uses it today
 * and the admin will use it tomorrow. Duplicating the logic guarantees the two
 * publish paths eventually produce inconsistent derived data.
 */

/**
 * Mid-range for adult prose reading. The figure only has to be defensible and
 * stable — an article whose estimate shifts between publishes looks broken.
 */
const WORDS_PER_MINUTE = 200;

export type TocEntry = {
  /** The block ID. Never a slug of the heading text — see `deriveToc`. */
  id: string;
  level: number;
  text: string;
};

/** Concatenates a block's text nodes. Leaf nodes such as images contribute nothing. */
function blockText(block: ContentBlock): string {
  return 'content' in block ? block.content.map((node) => node.text).join('') : '';
}

/**
 * Whole minutes, rounded up, never below one.
 *
 * Zero would render as "0 min de lectura", which reads as a bug rather than as
 * a short article.
 */
export function deriveReadingTime(doc: ContentDoc): number {
  const words = doc.content
    .map(blockText)
    .join(' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/**
 * Heading outline in document order.
 *
 * Anchors are the block IDs, **never** a slug of the heading text (ADR-0012).
 * Text-derived anchors break every deep link and every table-of-contents entry
 * the moment a heading is reworded, and that breakage is silent.
 *
 * Every heading level is kept. Which levels a table of contents actually shows
 * is a presentation choice that belongs to the component, not to data persisted
 * on an immutable revision.
 */
export function deriveToc(doc: ContentDoc): TocEntry[] {
  return doc.content.flatMap((block) =>
    block.type === 'heading'
      ? [{ id: block.attrs.blockId, level: block.attrs.level, text: blockText(block) }]
      : []
  );
}
