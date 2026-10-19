import { describe, expect, it } from 'vitest';

import {
  collectPublicationMedia,
  MAX_HIGHLIGHT_LANGUAGES,
  preparePublishedContent,
  publicationTags,
  renameLocalizationSchema,
} from '@/lib/publishing';

import type { ContentDoc } from '@/lib/content/schema';

const codeDoc: ContentDoc = {
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { blockId: 'code', language: 'javascript' },
      content: [{ type: 'text', text: '<script>alert("x")</script>' }],
    },
    {
      type: 'image',
      attrs: { blockId: 'image', mediaAssetId: 'asset', alt: 'Texto alternativo' },
    },
  ],
};

describe('publishing rules', () => {
  it('requires the protected rename action to carry redirect acknowledgement', () => {
    const mutation = {
      postId: crypto.randomUUID(),
      localizationId: crypto.randomUUID(),
      slug: 'nuevo-slug',
    };
    expect(renameLocalizationSchema.safeParse(mutation).success).toBe(false);
    expect(
      renameLocalizationSchema.safeParse({ ...mutation, acknowledgePermanentRedirect: false })
        .success
    ).toBe(true);
  });

  it('highlights code into a trust-safe published shape and derives exact media placements', async () => {
    const published = await preparePublishedContent(codeDoc);
    const code = published.content[0];
    expect(code).toMatchObject({ type: 'codeBlock', attrs: { blockId: 'code' } });
    expect(code).not.toHaveProperty('attrs.highlightedHtml');
    expect(code).toHaveProperty('attrs.highlighted.0.0.content');
    expect(collectPublicationMedia(published)).toEqual([
      { blockId: 'image', mediaAssetId: 'asset', position: 1, altText: 'Texto alternativo' },
    ]);
    expect(publicationTags('post', 'analysis', 'es')).toEqual([
      'post-post',
      'section-analysis',
      'locale-es',
      'rss',
      'sitemap',
    ]);
  });

  it('rejects duplicate block IDs and too many referenced media assets', async () => {
    await expect(
      preparePublishedContent({
        type: 'doc',
        content: [codeDoc.content[0]!, { ...codeDoc.content[0] }],
      })
    ).rejects.toThrow('duplicate-block-id');
    await expect(
      preparePublishedContent({
        type: 'doc',
        content: Array.from({ length: 101 }, (_, position) => ({
          type: 'image' as const,
          attrs: {
            blockId: `block-${position}`,
            mediaAssetId: `asset-${position}`,
            alt: '',
          },
        })),
      })
    ).rejects.toThrow('too-many-media');
  });

  it('falls back safely for unknown and prototype language names', async () => {
    for (const language of ['not-a-language', 'toString']) {
      const published = await preparePublishedContent({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { blockId: language, language },
            content: [{ type: 'text', text: '<plain>' }],
          },
        ],
      });
      expect(published.content[0]).toMatchObject({
        attrs: { highlighted: [[{ content: '<plain>' }]] },
      });
    }
  });

  it('bounds distinct highlight grammars before loading Shiki resources', async () => {
    const languages = ['javascript', 'typescript', 'css', 'html', 'json', 'bash', 'python', 'rust'];
    expect(languages).toHaveLength(MAX_HIGHLIGHT_LANGUAGES);
    const document = (values: string[]) => ({
      type: 'doc' as const,
      content: values.map((language, index) => ({
        type: 'codeBlock' as const,
        attrs: { blockId: `code-${index}`, language },
        content: [{ type: 'text' as const, text: language }],
      })),
    });

    await expect(preparePublishedContent(document(languages))).resolves.toBeTruthy();
    await expect(preparePublishedContent(document([...languages, 'go']))).rejects.toThrow(
      'too-many-highlight-languages'
    );
  });
});
