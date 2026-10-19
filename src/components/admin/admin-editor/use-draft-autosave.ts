import { useEffect, useRef, useState } from 'react';

import { callSaveDraft } from '@/lib/admin-actions';
import { createDraftSave, DraftAutosave } from '@/lib/draft-autosave';
import { parseDraftContent } from '@/lib/drafts';

import type { EditorDraft, SaveDraftInput } from '@/lib/drafts';

type SaveValue = Omit<SaveDraftInput, 'draftToken' | 'nextToken'>;
type EditableField = 'title' | 'excerpt';
export type SaveStatusValue = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
type Props = {
  postId: string;
  localizationId: string;
  draft: EditorDraft;
};

export function useDraftAutosave({ postId, localizationId, draft }: Props) {
  const [status, setStatus] = useState<SaveStatusValue>('saved');
  const statusRef = useRef<SaveStatusValue>('saved');
  // The opening state is "saved" too, but nothing was saved yet to announce.
  const [edited, setEdited] = useState(false);
  const fields = useRef({ title: draft.title, excerpt: draft.excerpt ?? '' });
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

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (statusRef.current !== 'saved') event.preventDefault();
    };
    addEventListener('beforeunload', unload);
    return () => removeEventListener('beforeunload', unload);
  }, []);

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

  function updateField(name: EditableField, value: string, content: unknown) {
    fields.current[name] = value;
    enqueue(content);
  }

  return { status, edited, enqueue, updateField, flush: () => autosave.flush() };
}
