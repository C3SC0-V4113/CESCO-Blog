// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreateCollection: vi.fn(),
  callRetryPendingPurges: vi.fn(),
  callSaveCollection: vi.fn(),
}));

import { AdminCollectionEditor } from '@/components/admin/admin-collections';
import { callSaveCollection } from '@/lib/admin-actions';

import type { AdminCollectionDetail } from '@/db/queries/admin-taxonomy';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const collection: AdminCollectionDetail = {
  id: crypto.randomUUID(),
  editorialState: 'active',
  coverMediaId: null,
  createdAt: '2026-08-20 12:00:00',
  updatedAt: '2026-08-20 12:00:00',
  localizations: [],
  postIds: [],
};

const fill = (locale: string, label: string, value: string) =>
  fireEvent.change(within(screen.getByRole('group', { name: locale })).getByLabelText(label), {
    target: { value },
  });

describe('AdminCollectionEditor', () => {
  it('saves a Spanish-only series without sending an empty English one', async () => {
    vi.mocked(callSaveCollection).mockResolvedValue({
      data: { status: 'saved' },
      error: undefined,
    } as never);
    render(<AdminCollectionEditor collection={collection} posts={[]} />);

    fill('Español', 'Título', 'El sonido en los juegos');
    fill('Español', 'Slug', 'el-sonido');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Cambios guardados.'));
    const [[input]] = vi.mocked(callSaveCollection).mock.calls;
    expect(input.localizations).toEqual([
      {
        id: expect.any(String),
        locale: 'es',
        slug: 'el-sonido',
        title: 'El sonido en los juegos',
        description: null,
        status: 'draft',
      },
    ]);
  });

  it('names the locale that is only partly filled instead of sending it', () => {
    render(<AdminCollectionEditor collection={collection} posts={[]} />);

    fill('Español', 'Título', 'El sonido en los juegos');
    fill('Español', 'Slug', 'el-sonido');
    fill('English', 'Slug', 'sound');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'El inglés necesita un título y un slug, o quedar vacío.'
    );
    expect(callSaveCollection).not.toHaveBeenCalled();
  });

  it('explains a slug another series already uses', async () => {
    vi.mocked(callSaveCollection).mockResolvedValue({
      data: undefined,
      error: { code: 'CONFLICT', message: 'collection-slug-reserved' },
    } as never);
    render(<AdminCollectionEditor collection={collection} posts={[]} />);

    fill('Español', 'Título', 'El sonido en los juegos');
    fill('Español', 'Slug', 'el-sonido');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Otra serie ya usa ese slug en este idioma.'
      )
    );
  });
});
