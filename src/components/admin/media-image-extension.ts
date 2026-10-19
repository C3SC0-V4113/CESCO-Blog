import { mergeAttributes, Node } from '@tiptap/core';

import { getTranslations } from '@/i18n/utils';

import type { DOMOutputSpec } from '@tiptap/pm/model';

const t = getTranslations('es');

export const mediaImageMarkup = (
  mediaAssetId: string,
  alt: string,
  resolveUrl: (id: string) => string | undefined
) => {
  const src = resolveUrl(mediaAssetId);
  return src
    ? (['img', { src, alt, 'data-media-asset-id': mediaAssetId }] as const)
    : ([
        'span',
        {
          role: 'img',
          'aria-label': alt || t('admin.media.unavailable'),
          'data-media-asset-id': mediaAssetId,
        },
        t('admin.media.unavailable'),
      ] as const);
};

export const MediaImage = Node.create<{ resolveUrl(id: string): string | undefined }>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions: () => ({ resolveUrl: () => '' }),
  addAttributes: () => ({
    blockId: { default: null },
    mediaAssetId: { default: null },
    alt: { default: '' },
  }),
  parseHTML: () => [{ tag: 'img[data-media-asset-id]' }],
  renderHTML({ node, HTMLAttributes }) {
    const markup = mediaImageMarkup(
      node.attrs.mediaAssetId as string,
      node.attrs.alt as string,
      this.options.resolveUrl
    );
    return [
      markup[0],
      mergeAttributes(HTMLAttributes, markup[1]),
      ...markup.slice(2),
    ] as DOMOutputSpec;
  },
});
