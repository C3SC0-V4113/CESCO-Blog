import { NodeSelection, Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { imageFilesToUpload, imageNode, mediaPath } from '@/lib/media';

import { EditorToolbar } from '../editor-toolbar';
import { createEditorExtensions } from './editor-extensions';
import { ImagePicker, useImagePicker } from './image-picker/image-picker';
import { LocaleSwitch } from './locale-switch';
import { SaveStatus } from './save-status';
import { useDraftAutosave } from './use-draft-autosave';
import { useWideEditor } from './use-wide-editor';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { EditorDraft, EditorLocalizations } from '@/lib/drafts';

const t = getTranslations('es');

type Props = {
  postId: string;
  localizationId: string;
  localizations: EditorLocalizations;
  draft: EditorDraft;
  mediaAssets: AdminMediaAsset[];
  referencedAssets: AdminMediaAsset[];
  mediaTotal: number;
};

export function AdminEditor({
  postId,
  localizationId,
  localizations,
  draft,
  mediaAssets,
  referencedAssets,
  mediaTotal,
}: Props) {
  const isWideEditor = useWideEditor();
  return (
    <ImagePicker.Root isWide={isWideEditor} assets={mediaAssets} total={mediaTotal}>
      <EditorComposition
        postId={postId}
        localizationId={localizationId}
        localizations={localizations}
        draft={draft}
        mediaAssets={mediaAssets}
        referencedAssets={referencedAssets}
        isWideEditor={isWideEditor}
      />
    </ImagePicker.Root>
  );
}

function EditorComposition({
  postId,
  localizationId,
  localizations,
  draft,
  mediaAssets,
  referencedAssets,
  isWideEditor,
}: Omit<Props, 'mediaTotal'> & { isWideEditor: boolean }) {
  const picker = useImagePicker();
  const autosave = useDraftAutosave({ postId, localizationId, draft });
  // Assets known when the editor opens never change, so they stay plain state.
  // One picked or uploaded later must resolve in the same call that inserts it,
  // before any re-render, so the event handler records it in a ref instead.
  const [knownUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...mediaAssets, ...referencedAssets].map((asset) => [asset.id, mediaPath(asset.r2Key)])
    )
  );
  const pickedUrls = useRef<Record<string, string>>({});
  const editorInitialized = useRef(false);
  const enqueue = autosave.enqueue;
  // Images pasted or dropped on the canvas go through the picker, so they meet
  // the same alt-text rule and the same upload as one chosen there (ADR-0024).
  // The picker opens so its alt field and any error are in view.
  function uploadFromCanvas(files: File[]) {
    picker.uploadFiles(files);
  }
  const editor = useEditor({
    immediatelyRender: false,
    content: draft.contentJson,
    onCreate: () => {
      editorInitialized.current = true;
    },
    editorProps: {
      attributes: {
        'aria-labelledby': 'editor-body-label',
        'aria-multiline': 'true',
        role: 'textbox',
      },
      handlePaste: (_view, event) => {
        const files = imageFilesToUpload(event.clipboardData);
        if (!files) return false;
        uploadFromCanvas(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFilesToUpload(event.dataTransfer);
        if (!files) return false;
        // The picker inserts at the selection, so the drop point becomes it.
        const target = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (target)
          view.dispatch(
            view.state.tr.setSelection(Selection.near(view.state.doc.resolve(target.pos)))
          );
        uploadFromCanvas(files);
        return true;
      },
    },
    extensions: createEditorExtensions((id) => pickedUrls.current[id] ?? knownUrls[id]),
    onUpdate: ({ editor: instance }) => {
      if (editorInitialized.current) enqueue(instance.getJSON());
    },
  });
  if (!editor) return <p>{t('admin.editor.loading')}</p>;
  const editField = (name: 'title' | 'excerpt', value: string) => {
    autosave.updateField(name, value, editor.getJSON());
  };
  const reviewHref = `/admin/review?post=${postId}&localization=${localizationId}`;
  return (
    <>
      <div className="grid min-w-0 content-start gap-4">
        <LocaleSwitch
          postId={postId}
          localizationId={localizationId}
          localizations={localizations}
          flush={autosave.flush}
        />
        {/* Each constraint sits outside its label: inside, it would be read twice,
          once in the name and again as the description. */}
        <Field>
          <FieldLabel htmlFor="editor-title">{t('admin.editor.postTitle')}</FieldLabel>
          <Input
            id="editor-title"
            name="title"
            aria-describedby="editor-title-constraint"
            defaultValue={draft.title}
            maxLength={300}
            onChange={(event) => editField('title', event.target.value)}
          />
          <FieldDescription id="editor-title-constraint">
            {t('admin.editor.titleConstraint')}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="editor-excerpt">{t('admin.editor.excerpt')}</FieldLabel>
          <Textarea
            id="editor-excerpt"
            name="excerpt"
            aria-describedby="editor-excerpt-constraint"
            size="compact"
            defaultValue={draft.excerpt ?? ''}
            maxLength={1000}
            onChange={(event) => editField('excerpt', event.target.value)}
          />
          <FieldDescription id="editor-excerpt-constraint">
            {t('admin.editor.excerptConstraint')}
          </FieldDescription>
        </Field>
        <EditorToolbar editor={editor} />
        <div>
          <p id="editor-body-label" className="mb-1 text-sm font-medium">
            {t('admin.editor.body')}
          </p>
          {/* The canvas is a text field, so its frame draws the same ring as the
            other fields while it holds focus. */}
          <EditorContent
            editor={editor}
            className="min-h-72 rounded-xl border bg-background p-4 transition-[border-color,box-shadow] duration-150 ease-out-quad has-[.ProseMirror:focus-visible]:border-ring has-[.ProseMirror:focus-visible]:ring-3 has-[.ProseMirror:focus-visible]:ring-ring motion-reduce:transition-none [&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={autosave.status} edited={autosave.edited} />
          <Button type="button" variant="outline" onClick={() => void autosave.flush()}>
            {t('admin.editor.save')}
          </Button>
          <a
            className={buttonVariants()}
            href={reviewHref}
            onClick={(event) => {
              event.preventDefault();
              void autosave
                .flush()
                .then((saved) => saved && window.location.assign(reviewHref))
                .catch(() => undefined);
            }}
          >
            {t('admin.editor.review')}
          </a>
        </div>
      </div>
      <ImagePicker.Panel
        onSelect={(asset) => {
          pickedUrls.current[asset.id] = mediaPath(asset.r2Key);
          const { selection } = editor.state;
          editor
            .chain()
            .focus()
            .insertContentAt(
              selection instanceof NodeSelection ? selection.to : selection,
              imageNode(asset.id, crypto.randomUUID(), asset.altText ?? '')
            )
            .run();
          if (!isWideEditor) picker.close(false);
        }}
      />
    </>
  );
}
