import { describe, expect, it } from 'vitest';

import {
  authorInputSchema,
  collectionInputSchema,
  seoDraftInputSchema,
} from '@/lib/admin-taxonomy';
import { effectiveSeo } from '@/lib/seo';

describe('admin taxonomy contracts', () => {
  it('normalizes author and collection slugs and rejects unsafe profile URLs', () => {
    expect(
      authorInputSchema.parse({
        id: crypto.randomUUID(),
        slug: '  Césco Valle ',
        name: 'Cesco Valle',
        bio: '',
        avatarMediaId: null,
        websiteUrl: 'https://example.com/about',
        sameAs: ['https://social.example/cesco'],
      })
    ).toMatchObject({ slug: 'cesco-valle', bio: null });

    expect(() =>
      authorInputSchema.parse({
        id: crypto.randomUUID(),
        slug: 'cesco',
        name: 'Cesco',
        avatarMediaId: null,
        websiteUrl: 'javascript:alert(1)',
        sameAs: [],
      })
    ).toThrow();

    expect(
      collectionInputSchema.parse({
        id: crypto.randomUUID(),
        editorialState: 'active',
        localizations: [
          {
            id: crypto.randomUUID(),
            locale: 'es',
            slug: ' El Sonido ',
            title: 'El sonido',
            description: '',
            status: 'draft',
          },
        ],
        postIds: [],
      }).localizations[0]
    ).toMatchObject({ slug: 'el-sonido', description: null });
  });

  it('takes the same draft tokens as the editor, seeded ones included', () => {
    const input = {
      postId: crypto.randomUUID(),
      localizationId: crypto.randomUUID(),
      draftToken: 'publish-token-chromium-0',
      nextToken: crypto.randomUUID(),
      seoTitle: '',
      seoDescription: '',
      ogTitle: '',
      ogDescription: '',
      ogImageMediaId: null,
      ogImageAlt: '',
      coverMediaId: null,
      authorId: null,
    };
    expect(seoDraftInputSchema.parse(input)).toMatchObject({
      draftToken: 'publish-token-chromium-0',
      nextToken: input.nextToken,
    });
    // The client names the token each attempt leaves behind (ADR-0035).
    expect(() => seoDraftInputSchema.parse({ ...input, nextToken: 'not-a-uuid' })).toThrow();
    expect(() => seoDraftInputSchema.parse({ ...input, nextToken: undefined })).toThrow();
  });

  it('keeps canonical generated and applies the public SEO fallback chain', () => {
    const input = seoDraftInputSchema.parse({
      postId: crypto.randomUUID(),
      localizationId: crypto.randomUUID(),
      draftToken: null,
      nextToken: crypto.randomUUID(),
      seoTitle: '',
      seoDescription: 'Descripción SEO',
      ogTitle: '',
      ogDescription: '',
      ogImageMediaId: null,
      ogImageAlt: '',
      coverMediaId: crypto.randomUUID(),
      authorId: null,
    });
    expect(input).not.toHaveProperty('canonicalUrl');
    expect(
      effectiveSeo({
        title: 'Título editorial',
        excerpt: 'Resumen editorial',
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        ogTitle: input.ogTitle,
        ogDescription: input.ogDescription,
      })
    ).toEqual({
      title: 'Título editorial',
      description: 'Descripción SEO',
      ogTitle: 'Título editorial',
      ogDescription: 'Descripción SEO',
    });
  });
});
