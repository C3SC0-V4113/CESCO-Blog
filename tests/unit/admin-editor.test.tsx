import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callSaveDraft: vi.fn(async ({ nextToken }: { nextToken: string }) => ({
    data: { draftToken: nextToken },
    error: undefined,
  })),
}));
vi.mock('@/lib/image-normalize', () => ({
  normalizeImage: vi.fn(async () => ({
    blob: new Blob(['webp'], { type: 'image/webp' }),
    width: 10,
    height: 10,
  })),
}));
import { AdminEditor } from '@/components/admin/admin-editor';
import { callSaveDraft } from '@/lib/admin-actions';
import { normalizeImage } from '@/lib/image-normalize';

import type { AdminMediaAsset } from '@/db/queries/admin-media';
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

const emptyDraft: EditorDraft = {
  title: 'Título',
  excerpt: null,
  draftToken: null,
  contentJson: { type: 'doc', content: [] },
};
const asset = (altText: string, r2Key: string): AdminMediaAsset => ({
  id: crypto.randomUUID(),
  r2Key,
  altText,
  caption: null,
  description: null,
  isOwnWork: false,
  creatorName: null,
  sourceUrl: null,
  licenseLabel: null,
  licenseUrl: null,
  contentType: 'image/webp',
  width: 10,
  height: 10,
  sizeBytes: 4,
  createdAt: '2026-09-10',
  updatedAt: '2026-09-10',
});

// jsdom has no layout, and ProseMirror measures a range to scroll the selection
// into view whenever a toolbar command focuses the editor.
beforeAll(() => {
  const empty = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => ({ ...empty, toJSON: () => empty });
});

describe('admin editor', () => {
  afterEach(() => vi.unstubAllGlobals());

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

  it('inserts a picked asset with a resolved source', async () => {
    const mapa = asset('Mapa', 'media/2026/09/mapa.webp');
    const view = render(
      <AdminEditor
        postId="p1"
        localizationId="l1"
        localizations={{ es: 'l1' }}
        draft={emptyDraft}
        mediaAssets={[mapa]}
        referencedAssets={[]}
        mediaTotal={1}
      />
    );
    const canvas = await screen.findByRole('textbox', { name: 'Contenido' });
    fireEvent.click(screen.getByRole('button', { name: /Mapa/ }));
    expect(within(canvas).getByRole('img', { name: 'Mapa' }).getAttribute('src')).toBe(
      '/media/2026/09/mapa.webp'
    );
    view.unmount();
  });

  it('sends an image pasted on the canvas through the picker upload', async () => {
    const uploaded = asset('Captura', 'media/2026/09/captura.webp');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(uploaded, { status: 201 }))
    );
    const view = render(
      <AdminEditor
        postId="p1"
        localizationId="l1"
        localizations={{ es: 'l1' }}
        draft={emptyDraft}
        mediaAssets={[]}
        referencedAssets={[]}
        mediaTotal={0}
      />
    );
    const canvas = await screen.findByRole('textbox', { name: 'Contenido' });
    const png = new File(['png'], 'captura.png', { type: 'image/png' });
    const clipboardData = { files: [png], getData: () => '' };

    // Without alt text the picker's rule holds: it opens, reports, and uploads nothing.
    fireEvent.paste(canvas, { clipboardData });
    expect(await screen.findByRole('alert')).toBeTruthy();
    const picker = screen
      .getAllByRole('group')
      .find((group): group is HTMLDetailsElement => group instanceof HTMLDetailsElement);
    expect(picker?.open).toBe(true);
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Texto alternativo'), {
      target: { value: 'Captura' },
    });
    fireEvent.paste(canvas, { clipboardData });
    const image = await within(canvas).findByRole('img', { name: 'Captura' });
    expect(image.getAttribute('src')).toBe('/media/2026/09/captura.webp');
    expect(normalizeImage).toHaveBeenCalledWith(png);
    expect(fetch).toHaveBeenCalledOnce();
    view.unmount();
  });

  // An inserted image leaves the selection on itself, and inserting over a node
  // selection replaces it, so the second of two pastes used to erase the first.
  it('keeps an image on the canvas when the next one is pasted', async () => {
    const first = asset('Primera', 'media/2026/09/primera.webp');
    const second = asset('Segunda', 'media/2026/09/segunda.webp');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(first, { status: 201 }))
        .mockResolvedValueOnce(Response.json(second, { status: 201 }))
    );
    const view = render(
      <AdminEditor
        postId="p1"
        localizationId="l1"
        localizations={{ es: 'l1' }}
        draft={emptyDraft}
        mediaAssets={[]}
        referencedAssets={[]}
        mediaTotal={0}
      />
    );
    const canvas = await screen.findByRole('textbox', { name: 'Contenido' });
    const clipboardData = {
      files: [new File(['png'], 'captura.png', { type: 'image/png' })],
      getData: () => '',
    };
    fireEvent.change(screen.getByLabelText('Texto alternativo'), {
      target: { value: 'Captura' },
    });

    fireEvent.paste(canvas, { clipboardData });
    await within(canvas).findByRole('img', { name: 'Primera' });
    fireEvent.paste(canvas, { clipboardData });
    await within(canvas).findByRole('img', { name: 'Segunda' });
    expect(
      within(canvas)
        .getAllByRole('img')
        .map((image) => image.getAttribute('alt'))
    ).toEqual(['Primera', 'Segunda']);
    view.unmount();
  });
});
