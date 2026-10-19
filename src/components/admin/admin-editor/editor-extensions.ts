import UniqueID from '@tiptap/extension-unique-id';
import StarterKit from '@tiptap/starter-kit';

import { MediaImage } from '../media-image-extension';

export function createEditorExtensions(resolveUrl: (id: string) => string | undefined) {
  return [
    StarterKit.configure({
      blockquote: false,
      bold: false,
      bulletList: false,
      code: false,
      hardBreak: false,
      horizontalRule: false,
      italic: false,
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
      strike: false,
      trailingNode: false,
      underline: false,
      heading: { levels: [2, 3] },
    }),
    UniqueID.configure({
      attributeName: 'blockId',
      types: ['paragraph', 'heading', 'codeBlock', 'image'],
      generateID: () => crypto.randomUUID(),
    }),
    MediaImage.configure({ resolveUrl }),
  ];
}
