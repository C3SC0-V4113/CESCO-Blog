import { NodeSelection, Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { XIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { imageFilesToUpload, imageNode, mediaPath } from '@/lib/media';
import { cn } from '@/lib/utils';

import { AdminMedia, type MediaUploader } from '../admin-media';
import { EditorToolbar } from '../editor-toolbar';
import { createEditorExtensions } from './editor-extensions';
import { LocaleSwitch } from './locale-switch';
import { SaveStatus } from './save-status';
import { useDraftAutosave } from './use-draft-autosave';
import { useWideEditor } from './use-wide-editor';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { EditorDraft, EditorLocalizations } from '@/lib/drafts';
import type { RefObject } from 'react';

const t = getTranslations('es');

function useEditorImagePicker(isWide: boolean) {
  const [openState, setOpenState] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const uploaderRef = useRef<MediaUploader>(null);
  const pendingFilesRef = useRef<File[] | null>(null);
  const restoreFocusRef = useRef(true);
  const openRef = useRef(false);

  function close(restoreFocus = true) {
    restoreFocusRef.current = restoreFocus;
    openRef.current = false;
    setOpenState(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }
  function open(focusHeading: boolean) {
    restoreFocusRef.current = true;
    openRef.current = true;
    setOpenState(true);
    if (focusHeading && isWide)
      requestAnimationFrame(() => {
        if (openRef.current) headingRef.current?.focus();
      });
  }
  function toggle() {
    if (openState) close();
    else open(true);
  }

  return {
    openState,
    open,
    close,
    toggle,
    headingRef,
    buttonRef,
    uploaderRef,
    pendingFilesRef,
    restoreFocusRef,
  };
}

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
  const picker = useEditorImagePicker(isWideEditor);
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
  const enqueue = autosave.enqueue;
  // Images pasted or dropped on the canvas go through the picker, so they meet
  // the same alt-text rule and the same upload as one chosen there (ADR-0024).
  // The picker opens so its alt field and any error are in view.
  function uploadFromCanvas(files: File[]) {
    if (picker.uploaderRef.current) picker.uploaderRef.current.upload(files);
    else picker.pendingFilesRef.current = files;
    picker.open(false);
  }
  const editor = useEditor({
    immediatelyRender: false,
    content: draft.contentJson,
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
    onUpdate: ({ editor: instance }) => enqueue(instance.getJSON()),
  });
  if (!editor) return <p>{t('admin.editor.loading')}</p>;
  const editField = (name: 'title' | 'excerpt', value: string) => {
    autosave.updateField(name, value, editor.getJSON());
  };
  const reviewHref = `/admin/review?post=${postId}&localization=${localizationId}`;
  return (
    <div
      className={cn(
        'grid gap-4',
        picker.openState && isWideEditor
          ? 'max-w-none grid-cols-editor-picker items-start'
          : 'max-w-4xl'
      )}
    >
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
        <EditorToolbar
          editor={editor}
          imagePickerOpen={picker.openState}
          imagePickerDesktop={isWideEditor}
          imagePickerButtonRef={picker.buttonRef}
          onToggleImagePicker={picker.toggle}
        />
        <div>
          <p id="editor-body-label" className="mb-1 text-sm font-medium">
            {t('admin.editor.body')}
          </p>
          {/* The canvas is a text field, so its frame draws the same ring as the
            other fields while it holds focus. */}
          <EditorContent
            editor={editor}
            className="min-h-72 rounded-xl border bg-background p-4 transition transition-field-frame duration-150 ease-out-quad has-[.ProseMirror:focus-visible]:border-ring has-[.ProseMirror:focus-visible]:ring-3 has-[.ProseMirror:focus-visible]:ring-ring motion-reduce:transition-none [&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none"
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
      <EditorImagePicker
        open={picker.openState}
        isWide={isWideEditor}
        assets={mediaAssets}
        total={mediaTotal}
        uploaderRef={picker.uploaderRef}
        pendingFilesRef={picker.pendingFilesRef}
        restoreFocusRef={picker.restoreFocusRef}
        headingRef={picker.headingRef}
        buttonRef={picker.buttonRef}
        onClose={picker.close}
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
    </div>
  );
}

type ImagePickerProps = {
  open: boolean;
  isWide: boolean;
  assets: AdminMediaAsset[];
  total: number;
  uploaderRef: RefObject<MediaUploader | null>;
  pendingFilesRef: RefObject<File[] | null>;
  restoreFocusRef: RefObject<boolean>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onClose(restoreFocus?: boolean): void;
  onSelect(asset: AdminMediaAsset): void;
};

function EditorImagePicker({
  open,
  isWide,
  assets,
  total,
  uploaderRef,
  pendingFilesRef,
  restoreFocusRef,
  headingRef,
  buttonRef,
  onClose,
  onSelect,
}: ImagePickerProps) {
  function attachUploader(instance: MediaUploader | null) {
    uploaderRef.current = instance;
    if (!instance || !pendingFilesRef.current) return;
    const files = pendingFilesRef.current;
    pendingFilesRef.current = null;
    // The sheet popup mounts through a portal after the editor commits.
    queueMicrotask(() => {
      if (uploaderRef.current === instance) instance.upload(files);
      else pendingFilesRef.current ??= files;
    });
  }

  return (
    <>
      {isWide && (
        <aside
          id="editor-image-picker"
          aria-labelledby="editor-image-picker-heading"
          className={cn(
            'sticky top-4 max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4 transition transition-picker transition-discrete duration-200 ease-out-cubic starting:opacity-0 motion-safe:starting:translate-x-2',
            open
              ? 'flex translate-x-0 opacity-100'
              : 'pointer-events-none hidden opacity-0 duration-150 motion-safe:translate-x-2'
          )}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="editor-image-picker-heading"
              ref={headingRef}
              tabIndex={-1}
              className="flex min-w-0 items-center gap-2 font-heading text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {t('admin.editor.insertImage')}
            </h2>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t('admin.editor.closeImagePicker')}
              onClick={() => onClose()}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          {open && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <AdminMedia
                  ref={attachUploader}
                  assets={assets}
                  total={total}
                  showLibraryLink={false}
                  onSelect={onSelect}
                />
              </div>
              <footer className="border-t pt-3">
                <a className={buttonVariants({ variant: 'link' })} href="/admin/media">
                  {t('admin.media.openLibrary')}
                </a>
              </footer>
            </>
          )}
        </aside>
      )}
      {!isWide && (
        <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
          {open && (
            <SheetContent
              side="bottom"
              initialFocus={() => headingRef.current}
              finalFocus={() => (restoreFocusRef.current ? buttonRef.current : false)}
              closeLabel={t('admin.editor.closeImagePicker')}
            >
              <SheetHeader closeButton>
                <SheetTitle ref={headingRef} tabIndex={-1}>
                  {t('admin.editor.insertImage')}
                </SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                <AdminMedia
                  ref={attachUploader}
                  assets={assets}
                  total={total}
                  onSelect={onSelect}
                />
              </div>
            </SheetContent>
          )}
        </Sheet>
      )}
    </>
  );
}
