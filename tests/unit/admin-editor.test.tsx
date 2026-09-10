import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callSaveDraft: vi.fn(async ({ nextToken }: { nextToken: string }) => ({
    data: { draftToken: nextToken },
    error: undefined,
  })),
}));
import { AdminEditor } from '@/components/admin/admin-editor';
import { callSaveDraft } from '@/lib/admin-actions';

import type { EditorDraft } from '@/lib/drafts';

// A published revision may hold any heading level while a draft accepts only h2
// and h3, so a draft cloned from such a revision is invalid before anyone types.
const draft: EditorDraft = {
  title: 'Título',
  excerpt: null,
  draftToken: null,
  contentJson: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { blockId: 'h1', level: 1 },
        content: [{ type: 'text', text: 'Texto confidencial' }],
      },
    ],
  },
};

// jsdom has no layout, and ProseMirror measures a range to scroll the selection
// into view whenever a toolbar command focuses the editor.
beforeAll(() => {
  const empty = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ ...empty, toJSON: () => empty });
});

describe('admin editor', () => {
  it('reports an edit the draft contract rejects and recovers on the next valid one', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(
      <AdminEditor
        postId="p1"
        localizationId="l1"
        localizations={{ es: 'l1' }}
        draft={draft}
        mediaAssets={[]}
        referencedAssets={[]}
        mediaTotal={0}
      />
    );
    // The label also wraps the length constraint, which joins the accessible name.
    fireEvent.change(await screen.findByRole('textbox', { name: /^Título/ }), {
      target: { value: 'Título nuevo' },
    });
    expect(screen.getByRole('status').textContent).toBe(
      'No se pudo guardar. Edita nuevamente para reintentar.'
    );
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/confidencial|Título nuevo/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    await Promise.resolve();
    expect(callSaveDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Párrafo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ahora' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Guardado'));
    expect(callSaveDraft).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Título nuevo',
        draftToken: null,
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: { blockId: expect.any(String) },
              content: [{ type: 'text', text: 'Texto confidencial' }],
            },
          ],
        },
      })
    );
    view.unmount();
  });
});
