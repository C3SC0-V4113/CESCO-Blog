import { describe, expect, it } from 'vitest';

import { contentDocSchema, parseContentDoc } from '@/lib/content/schema';

/**
 * The contract between the three producers and consumers of `content_json`
 * (ADR-0024): the Tiptap editor produces it, the seed script produces it, and
 * `ArticleBody` consumes it. Without this schema the two producers drift apart
 * silently and the failure surfaces as a broken article rather than an error.
 */

const blockId = '0b7f1f6a-2a1e-4f0e-9f7a-2b6f0c1d4e5a';

describe('content_json schema', () => {
  it('accepts an empty document', () => {
    // The existing integration fixtures seed exactly this shape, and a draft
    // starts empty in the editor. Rejecting it would break both.
    expect(contentDocSchema.safeParse({ type: 'doc', content: [] }).success).toBe(true);
  });

  it('accepts the minimum node set', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { blockId, level: 2 },
          content: [{ type: 'text', text: 'Combate' }],
        },
        {
          type: 'paragraph',
          attrs: { blockId: `${blockId}-p` },
          content: [{ type: 'text', text: 'Un párrafo.' }],
        },
        {
          type: 'image',
          attrs: { blockId: `${blockId}-i`, mediaAssetId: 'media-1', alt: 'Captura' },
        },
        {
          type: 'codeBlock',
          attrs: { blockId: `${blockId}-c`, language: 'ts' },
          content: [{ type: 'text', text: 'const a = 1;' }],
        },
      ],
    };

    expect(contentDocSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects a block node without a blockId', () => {
    // `post_revision_media` keys inline placements by `block_id` and TOC anchors
    // derive from it (ADR-0012). A block without one is unaddressable.
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sin id.' }] }],
    };

    expect(contentDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an image node without a mediaAssetId', () => {
    // An image that names no asset cannot produce a `post_revision_media` row,
    // so the document and the relational schema would disagree (ADR-0024).
    const doc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { blockId, alt: 'Huérfana' } }],
    };

    expect(contentDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects a heading without a level', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { blockId }, content: [{ type: 'text', text: 'X' }] }],
    };

    expect(contentDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown node type', () => {
    // The renderer switches exhaustively over node types. An unknown node would
    // render as nothing, silently dropping content.
    const doc = {
      type: 'doc',
      content: [{ type: 'blockquote', attrs: { blockId }, content: [] }],
    };

    expect(contentDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects a document whose root is not a doc', () => {
    expect(contentDocSchema.safeParse({ type: 'paragraph', content: [] }).success).toBe(false);
  });

  it('throws through parseContentDoc so a bad seed fails loudly', () => {
    expect(() => parseContentDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toThrow();
  });

  it('returns a typed document through parseContentDoc', () => {
    const doc = parseContentDoc({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { blockId }, content: [{ type: 'text', text: 'Hola.' }] },
      ],
    });

    expect(doc.content[0]?.attrs.blockId).toBe(blockId);
  });
});
