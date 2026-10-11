import UniqueID from '@tiptap/extension-unique-id';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getTranslations } from '@/i18n/utils';
import { callSaveDraft } from '@/lib/admin-actions';
import { createDraftSave, DraftAutosave } from '@/lib/draft-autosave';
import { parseDraftContent } from '@/lib/drafts';
import { imageFilesToUpload, imageNode, mediaPath } from '@/lib/media';
import { cn } from '@/lib/utils';

import { inputClass, textareaClass } from './admin-form';
import { AdminMedia, type MediaUploader } from './admin-media';
import { EditorToolbar } from './editor-toolbar';
import { MediaImage } from './media-image-extension';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
import type { EditorDraft, EditorLocalizations, SaveDraftInput } from '@/lib/drafts';

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
  const statusRef = useRef<Status>('saved');
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
  const picker = useRef<HTMLDetailsElement>(null);
  const uploader = useRef<MediaUploader>(null);
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
    if (picker.current) picker.current.open = true;
    uploader.current?.upload(files);
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
    <div className="grid max-w-4xl gap-4">
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
          className={cn('h-10', inputClass)}
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
          className={cn('min-h-20', textareaClass)}
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
      {/* Concentric with the media surfaces inside: their radius-lg plus p-4. */}
      <details ref={picker} className="rounded-4xl border bg-background p-4">
        <summary className="cursor-pointer font-medium">{t('admin.editor.insertImage')}</summary>
        <div className="mt-4">
          <AdminMedia
            ref={uploader}
            assets={mediaAssets}
            total={mediaTotal}
            onSelect={(asset) => {
              pickedUrls.current[asset.id] = mediaPath(asset.r2Key);
              // An inserted image keeps the selection on itself, and inserting over
              // a node selection replaces the node, so the next paste or drop would
              // erase the image before it. A selected node gets the new one after it.
              const { selection } = editor.state;
              editor
                .chain()
                .focus()
                .insertContentAt(
                  selection instanceof NodeSelection ? selection.to : selection,
                  imageNode(asset.id, crypto.randomUUID(), asset.altText ?? '')
                )
                .run();
            }}
          />
        </div>
      </details>
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
