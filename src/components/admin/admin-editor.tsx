import UniqueID from '@tiptap/extension-unique-id';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Code2Icon,
  Heading2Icon,
  Heading3Icon,
  PilcrowIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callSaveDraft } from '@/lib/admin-actions';
import { parseContentDoc } from '@/lib/content/schema';
import { DraftAutosave } from '@/lib/draft-autosave';

import type { EditorDraft, EditorLocalizations, SaveDraftInput } from '@/lib/drafts';

const t = getTranslations('es');
type Props = {
  postId: string;
  localizationId: string;
  localizations: EditorLocalizations;
  draft: EditorDraft;
};
type SaveValue = Omit<SaveDraftInput, 'draftToken'>;
type Status = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
const localeLabel = (locale: 'es' | 'en') => t(`admin.editor.locale.${locale}`);

export function AdminEditor({ postId, localizationId, localizations, draft }: Props) {
  const [status, setStatus] = useState<Status>('saved');
  const statusRef = useRef<Status>('saved');
  const token = useRef(draft.draftToken);
  const fields = useRef({ title: draft.title, excerpt: draft.excerpt ?? '' });
  const autosave = useRef<DraftAutosave<SaveValue> | null>(null);
  autosave.current ??= new DraftAutosave(
    async (value) => {
      const result = await callSaveDraft({ ...value, draftToken: token.current });
      if (result.error) throw result;
      token.current = result.data.draftToken;
    },
    1_000,
    (next) => {
      statusRef.current = next;
      setStatus(next);
    }
  );

  function enqueue(content: unknown) {
    autosave.current?.change({
      postId,
      localizationId,
      ...fields.current,
      excerpt: fields.current.excerpt || null,
      contentJson: parseContentDoc(content),
    });
  }
  const editor = useEditor({
    immediatelyRender: false,
    content: draft.contentJson,
    editorProps: {
      attributes: {
        'aria-label': t('admin.editor.body'),
        'aria-multiline': 'true',
        role: 'textbox',
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
        types: ['paragraph', 'heading', 'codeBlock'],
        generateID: () => crypto.randomUUID(),
      }),
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
  const tools = [
    ['admin.editor.paragraph', PilcrowIcon, () => editor.chain().focus().setParagraph().run()],
    [
      'admin.editor.heading2',
      Heading2Icon,
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    [
      'admin.editor.heading3',
      Heading3Icon,
      () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    ],
    ['admin.editor.code', Code2Icon, () => editor.chain().focus().toggleCodeBlock().run()],
    ['admin.editor.undo', Undo2Icon, () => editor.chain().focus().undo().run()],
    ['admin.editor.redo', Redo2Icon, () => editor.chain().focus().redo().run()],
  ] as const;
  const editField = (name: 'title' | 'excerpt', value: string) => {
    fields.current[name] = value;
    enqueue(editor.getJSON());
  };
  const currentLocale = localizations.es === localizationId ? 'es' : 'en';
  return (
    <div className="grid max-w-4xl gap-4">
      <div>
        <p className="mb-1 text-sm font-medium">{t('admin.editor.locale')}</p>
        <div className="flex gap-2" role="group" aria-label={t('admin.editor.locale')}>
          {(['es', 'en'] as const).map((locale) => {
            const id = localizations[locale];
            if (locale === currentLocale)
              return (
                <Button key={locale} type="button" disabled aria-current="page">
                  {localeLabel(locale)} ({t('admin.editor.locale.current')})
                </Button>
              );
            if (!id)
              return (
                <Button key={locale} type="button" variant="outline" disabled>
                  {localeLabel(locale)} ({t('admin.editor.locale.missing')})
                </Button>
              );
            const href = `/admin/posts/${postId}/edit?localization=${id}`;
            return (
              <a
                key={locale}
                className={buttonVariants({ variant: 'outline' })}
                href={href}
                onClick={(event) => {
                  event.preventDefault();
                  void autosave.current
                    ?.flush()
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
      <label>
        {t('admin.editor.postTitle')}
        <input
          aria-describedby="editor-title-constraint"
          className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
          defaultValue={draft.title}
          maxLength={300}
          onChange={(event) => editField('title', event.target.value)}
        />
        <span id="editor-title-constraint" className="mt-1 block text-sm text-muted-foreground">
          {t('admin.editor.titleConstraint')}
        </span>
      </label>
      <label>
        {t('admin.editor.excerpt')}
        <textarea
          aria-describedby="editor-excerpt-constraint"
          className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3"
          defaultValue={draft.excerpt ?? ''}
          maxLength={1000}
          onChange={(event) => editField('excerpt', event.target.value)}
        />
        <span id="editor-excerpt-constraint" className="mt-1 block text-sm text-muted-foreground">
          {t('admin.editor.excerptConstraint')}
        </span>
      </label>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t('admin.editor.toolbar')}>
        {tools.map(([label, Icon, run]) => (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t(label)}
            onClick={run}
            key={label}
          >
            <Icon />
          </Button>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className="min-h-72 rounded-xl border bg-background p-4 [&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none"
      />
      <div className="flex items-center gap-3">
        <p role="status">{t(`admin.editor.status.${status}`)}</p>
        <Button type="button" variant="outline" onClick={() => void autosave.current?.flush()}>
          {t('admin.editor.save')}
        </Button>
      </div>
    </div>
  );
}
