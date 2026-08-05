import { z } from 'zod';

/**
 * The `content_json` contract (ADR-0024).
 *
 * Three parties must agree on this shape: the Tiptap editor produces it, the
 * seed script of ADR-0017 also produces it, and `ArticleBody` consumes it when
 * rendering. Without a shared schema the two producers drift apart silently and
 * the failure surfaces as a broken article rather than an error.
 *
 * Every block node carries a `blockId`. Those IDs are the same identifiers
 * `post_revision_media` uses to key inline image placements, and the ones
 * `toc_json` anchors derive from, so that rewording a heading does not break a
 * deep link (ADR-0012).
 *
 * Objects are **strict**: an unknown key is an error, not something to drop.
 * A stripping schema would silently discard editor output — marks, custom
 * attributes — and the loss would only surface as missing formatting on an
 * already-published article. Extending the node set is a deliberate edit here.
 */

const textNodeSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
});

/**
 * Absent in the editor's output for an empty block, so it is defaulted rather
 * than required. Consumers always receive an array and never branch on
 * `undefined`.
 */
const inlineContentSchema = z.array(textNodeSchema).default([]);

const blockIdSchema = z.string().min(1);

const paragraphNodeSchema = z.strictObject({
  type: z.literal('paragraph'),
  attrs: z.strictObject({ blockId: blockIdSchema }),
  content: inlineContentSchema,
});

const headingNodeSchema = z.strictObject({
  type: z.literal('heading'),
  attrs: z.strictObject({
    blockId: blockIdSchema,
    level: z.number().int().min(1).max(6),
  }),
  content: inlineContentSchema,
});

const codeBlockNodeSchema = z.strictObject({
  type: z.literal('codeBlock'),
  attrs: z.strictObject({
    blockId: blockIdSchema,
    language: z.string().nullish(),
  }),
  content: inlineContentSchema,
});

/**
 * A leaf node: it names an asset instead of holding text. `mediaAssetId` is
 * required because an image that names no asset cannot produce a
 * `post_revision_media` row, which would put the document and the relational
 * schema out of agreement (ADR-0024).
 */
const imageNodeSchema = z.strictObject({
  type: z.literal('image'),
  attrs: z.strictObject({
    blockId: blockIdSchema,
    mediaAssetId: z.string().min(1),
    alt: z.string().nullish(),
  }),
});

// Not exported: the document schema is the entry point, and an exported name
// with no caller is maintenance surface rather than preparation. The block
// *type* below is exported because `derive.ts` consumes it.
const contentBlockSchema = z.discriminatedUnion('type', [
  paragraphNodeSchema,
  headingNodeSchema,
  codeBlockNodeSchema,
  imageNodeSchema,
]);

export const contentDocSchema = z.strictObject({
  type: z.literal('doc'),
  content: z.array(contentBlockSchema).default([]),
});

export type ContentDoc = z.infer<typeof contentDocSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;

/**
 * Validates and returns the typed document, throwing on anything invalid.
 *
 * Publishing paths use this rather than `safeParse`: a malformed document must
 * stop the write, not reach D1 and surface later as a broken page.
 */
export function parseContentDoc(value: unknown): ContentDoc {
  return contentDocSchema.parse(value);
}
