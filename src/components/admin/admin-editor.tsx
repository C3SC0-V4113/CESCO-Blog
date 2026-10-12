import UniqueID from '@tiptap/extension-unique-id';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { callSaveDraft } from '@/lib/admin-actions';
import { createDraftSave, DraftAutosave } from '@/lib/draft-autosave';
import { parseDraftContent } from '@/lib/drafts';
import { imageFilesToUpload, imageNode, mediaPath } from '@/lib/media';
import { cn } from '@/lib/utils';

import { AdminMedia, type MediaUploader } from './admin-media';
import { EditorToolbar } from './editor-toolbar';
import { MediaImage } from './media-image-extension';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { EditorDraft, EditorLocalizations, SaveDraftInput } from '@/lib/drafts';
import type { RefObject } from 'react';

const t = getTranslations('es');
const wideEditorQuery = '(min-width: 1440px)';
const subscribeWideEditor = (callback: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(wideEditorQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const getWideEditorSnapshot = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(wideEditorQuery).matches;
const getWideEditorServerSnapshot = () => false;

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
type SaveValue = Omit<SaveDraftInput, 'draftToken' | 'nextToken'>;
type Status = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
const localeLabel = (locale: 'es' | 'en') => t(`admin.editor.locale.${locale}`);
const pill = 'inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium';

export function AdminEditor({
  postId,
  localizationId,
  localizations,
  draft,
  mediaAssets,
  referencedAssets,
  mediaTotal,
}: Props) {
  const [status, setStatus] = useState<Status>('saved');
  const isWideEditor = useSyncExternalStore(
    subscribeWideEditor,
    getWideEditorSnapshot,
    getWideEditorServerSnapshot
  );
  const statusRef = useRef<Status>('saved');
  const picker = useEditorImagePicker(isWideEditor);
  // The opening state is "saved" too, but nothing was saved yet to announce.
  const [edited, setEdited] = useState(false);
  const fields = useRef({ title: draft.title, excerpt: draft.excerpt ?? '' });
  // Assets known when the editor opens never change, so they stay plain state.
  // One picked or uploaded later must resolve in the same call that inserts it,
  // before any re-render, so the event handler records it in a ref instead.
  const [knownUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...mediaAssets, ...referencedAssets].map((asset) => [asset.id, mediaPath(asset.r2Key)])
    )
  );
  const pickedUrls = useRef<Record<string, string>>({});
  // Created once: it owns the save queue and the attempt tokens, and both must
  // outlive every render.
  const [autosave] = useState(
    () =>
      new DraftAutosave(
        createDraftSave<SaveValue>(draft.draftToken, async (value, tokens) => {
          const result = await callSaveDraft({ ...value, ...tokens });
          if (result.error) throw result;
        }),
        1_000,
        (next) => {
          statusRef.current = next;
          setStatus(next);
          if (next !== 'saved') setEdited(true);
        }
      )
  );

  // Runs inside Tiptap's onUpdate, where a throw would drop the edit while the
  // status still claimed it was saved.
  function enqueue(content: unknown) {
    const parsed = parseDraftContent(content);
    if (!parsed.success) {
      // Paths and codes only: the draft text stays out of the console.
      console.error(`Draft content rejected: ${parsed.issues.join('; ')}`);
      autosave.markInvalid();
      return;
    }
    autosave.change({
      postId,
      localizationId,
      ...fields.current,
      excerpt: fields.current.excerpt || null,
      contentJson: parsed.data,
    });
  }
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
    extensions: [
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
      MediaImage.configure({ resolveUrl: (id) => pickedUrls.current[id] ?? knownUrls[id] }),
    ],
    onUpdate: ({ editor: instance }) => enqueue(instance.getJSON()),
  });
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (statusRef.current !== 'saved') event.preventDefault();
    };
    addEventListener('beforeunload', unload);
    return () => removeEventListener('beforeunload', unload);
  }, []);
  if (!editor) return <p>{t('admin.editor.loading')}</p>;
  const editField = (name: 'title' | 'excerpt', value: string) => {
    fields.current[name] = value;
    enqueue(editor.getJSON());
  };
  const currentLocale = localizations.es === localizationId ? 'es' : 'en';
  const reviewHref = `/admin/review?post=${postId}&localization=${localizationId}`;
  return (
    <div
      className={cn(
        'grid gap-4',
        picker.openState && isWideEditor
          ? 'max-w-none grid-cols-[minmax(0,1fr)_22rem] items-start'
          : 'max-w-4xl'
      )}
    >
      <div className="grid min-w-0 content-start gap-4">
        <div>
          <p className="mb-1 text-sm font-medium">{t('admin.editor.locale')}</p>
          {/* Only the other locale is a destination. The current one and a
            missing one are plain text, so nothing focusable does nothing. */}
          <div className="flex gap-2" role="group" aria-label={t('admin.editor.locale')}>
            {(['es', 'en'] as const).map((locale) => {
              const id = localizations[locale];
              if (locale === currentLocale)
                return (
                  <span
                    key={locale}
                    aria-current="page"
                    className={cn(pill, 'bg-primary text-primary-foreground')}
                  >
                    {localeLabel(locale)} ({t('admin.editor.locale.current')})
                  </span>
                );
              if (!id)
                return (
                  <span
                    key={locale}
                    className={cn(pill, 'border border-dashed text-muted-foreground')}
                  >
                    {localeLabel(locale)} ({t('admin.editor.locale.missing')})
                  </span>
                );
              const href = `/admin/posts/${postId}/edit?localization=${id}`;
              return (
                <a
                  key={locale}
                  className={buttonVariants({ variant: 'outline' })}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    void autosave
                      .flush()
                      .then((saved) => saved && window.location.assign(href))
                      .catch(() => undefined);
                  }}
                >
                  {localeLabel(locale)}
                </a>
              );
            })}
          </div>
        </div>
        {/* Each constraint sits outside its label: inside, it would be read twice,
          once in the name and again as the description. */}
        <Field className="gap-2">
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
        <Field className="gap-2">
          <FieldLabel htmlFor="editor-excerpt">{t('admin.editor.excerpt')}</FieldLabel>
          <Textarea
            id="editor-excerpt"
            name="excerpt"
            aria-describedby="editor-excerpt-constraint"
            className="min-h-20"
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
            className="min-h-72 rounded-xl border bg-background p-4 transition-[border-color,box-shadow] duration-150 ease-out-quad has-[.ProseMirror:focus-visible]:border-ring has-[.ProseMirror:focus-visible]:ring-3 has-[.ProseMirror:focus-visible]:ring-ring motion-reduce:transition-none [&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={status} edited={edited} />
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
          aria-hidden={!open}
          inert={!open}
          className={cn(
            'sticky top-4 max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-xl border bg-background p-4 transition-[opacity,translate,display] [transition-behavior:allow-discrete] duration-200 ease-out-cubic [@starting-style]:opacity-0 motion-safe:[@starting-style]:translate-x-2',
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
              finalFocus={() => (restoreFocusRef.current ? buttonRef.current : false)}
              closeLabel={t('admin.editor.closeImagePicker')}
              className="max-h-[85dvh] px-0 pb-[env(safe-area-inset-bottom)]"
            >
              <SheetHeader className="pr-12">
                <SheetTitle>{t('admin.editor.insertImage')}</SheetTitle>
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

/**
 * The visible line follows every state. Screen readers hear a landed save,
 * through a region that is always there, and a failure, which interrupts;
 * typing does not announce "pending" on every keystroke.
 */
function SaveStatus({ status, edited }: { status: Status; edited: boolean }) {
  return (
    <>
      {status === 'failed' || status === 'conflict' ? (
        <p role="alert">{t(`admin.editor.status.${status}`)}</p>
      ) : (
        <p>{t(`admin.editor.status.${status}`)}</p>
      )}
      <p role="status" className="sr-only">
        {edited && status === 'saved' ? t('admin.editor.status.saved') : ''}
      </p>
    </>
  );
}
