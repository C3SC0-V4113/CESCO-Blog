import { bundledLanguages, createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { z } from 'zod';

import { normalizeSlug } from '@/lib/admin-posts';
import {
  parseContentDoc,
  parsePublishedContentDoc,
  type ContentDoc,
  type PublishedContentDoc,
} from '@/lib/content/schema';

import type { PostSection } from '@/db/queries/posts';
import type { Locale } from '@/i18n/locales';

export const MAX_PUBLICATION_MEDIA = 100;
export const MAX_HIGHLIGHT_LANGUAGES = 8;
export const PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED =
  'PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED' as const;
export const publishSchema = z.strictObject({
  postId: z.uuid(),
  localizationId: z.uuid(),
  draftToken: z.string().min(1),
  operationId: z.uuid(),
});
export const localizationMutationSchema = z.strictObject({
  postId: z.uuid(),
  localizationId: z.uuid(),
});
export const unpublishSchema = localizationMutationSchema.extend({
  // The revision the reviewer saw. Optional because the guard against
  // withdrawing nothing holds without it; with it, a republication that landed
  // after the page loaded is not withdrawn by a click aimed at the older one.
  publishedRevisionId: z.uuid().optional(),
});
export const renameLocalizationSchema = localizationMutationSchema.extend({
  slug: z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160)),
  acknowledgePermanentRedirect: z.boolean(),
});
export type PublishInput = z.infer<typeof publishSchema>;
export type UnpublishInput = z.infer<typeof unpublishSchema>;
export type RenameLocalizationInput = z.infer<typeof renameLocalizationSchema>;
export type RenameLocalizationRejection = {
  status: 'rejected';
  code: typeof PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED;
};

export function isRenameLocalizationRejection(
  value: unknown
): value is RenameLocalizationRejection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'rejected' &&
    'code' in value &&
    value.code === PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED
  );
}
export type PublicationPlacement = {
  blockId: string;
  mediaAssetId: string;
  position: number;
  altText: string;
};

function assertDocumentBounds(doc: ContentDoc): void {
  const ids = new Set<string>();
  let media = 0;
  for (const block of doc.content) {
    if (ids.has(block.attrs.blockId)) throw Error('duplicate-block-id');
    ids.add(block.attrs.blockId);
    if (block.type === 'image' && ++media > MAX_PUBLICATION_MEDIA) throw Error('too-many-media');
  }
}

function isBundledLanguage(language: string): language is keyof typeof bundledLanguages {
  return Object.prototype.hasOwnProperty.call(bundledLanguages, language);
}

export async function preparePublishedContent(value: unknown): Promise<PublishedContentDoc> {
  const doc = parseContentDoc(value);
  assertDocumentBounds(doc);
  const languages = [
    ...new Set(
      doc.content.flatMap((block) => {
        const language = block.type === 'codeBlock' ? block.attrs.language : null;
        return language && isBundledLanguage(language) ? [language] : [];
      })
    ),
  ];
  if (languages.length > MAX_HIGHLIGHT_LANGUAGES) throw Error('too-many-highlight-languages');
  const highlighter = await createHighlighter({
    themes: ['github-light'],
    langs: languages,
    engine: createJavaScriptRegexEngine(),
  });
  try {
    return parsePublishedContentDoc({
      ...doc,
      content: doc.content.map((block) => {
        if (block.type !== 'codeBlock') return block;
        const code = block.content.map((node) => node.text).join('');
        const requested = block.attrs.language ?? 'text';
        const language = isBundledLanguage(requested) ? requested : 'text';
        const result = highlighter.codeToTokens(code, { lang: language, theme: 'github-light' });
        return {
          ...block,
          attrs: {
            ...block.attrs,
            highlighted: result.tokens.map((line) =>
              line.map(({ content, color, fontStyle }) => ({
                content,
                ...(color ? { color } : {}),
                ...(fontStyle === undefined ? {} : { fontStyle }),
              }))
            ),
          },
        };
      }),
    });
  } finally {
    highlighter.dispose();
  }
}

export function collectPublicationMedia(doc: PublishedContentDoc): PublicationPlacement[] {
  return doc.content.flatMap((block, position) =>
    block.type === 'image'
      ? [
          {
            blockId: block.attrs.blockId,
            mediaAssetId: block.attrs.mediaAssetId,
            position,
            altText: block.attrs.alt,
          },
        ]
      : []
  );
}

export function publicationTags(postId: string, section: PostSection, locale: Locale): string[] {
  return [`post-${postId}`, `section-${section}`, `locale-${locale}`, 'rss', 'sitemap'];
}
