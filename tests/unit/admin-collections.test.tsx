import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreateCollection: vi.fn(),
  callRetryPendingPurges: vi.fn(),
  callSaveCollection: vi.fn(),
}));

import { AdminCollectionEditor, AdminCollections } from '@/components/admin/admin-collections';
import { callCreateCollection, callSaveCollection } from '@/lib/admin-actions';

import type { AdminCollectionDetail, AdminMembershipPost } from '@/db/queries/admin-taxonomy';

afterEach(() => {
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

    // The member list keeps a status region of its own, so this one is found by its text.
    await waitFor(() =>
      expect(screen.getByText('Cambios guardados.').getAttribute('role')).toBe('status')
    );
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

    const title = within(screen.getByRole('group', { name: 'English' })).getByLabelText('Título');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.matches(':focus')).toBe(true);
    expect(title.getAttribute('aria-describedby')).toBe(
      screen.getByText('El inglés necesita un título y un slug, o quedar vacío.').id
    );
    expect(callSaveCollection).not.toHaveBeenCalled();
  });

  it('points at the slug when only the slug is missing', () => {
    render(<AdminCollectionEditor collection={collection} posts={[]} />);

    fill('Español', 'Título', 'El sonido en los juegos');
    fireEvent.submit((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).form!);

    const slug = within(screen.getByRole('group', { name: 'Español' })).getByLabelText('Slug');
    expect(slug.getAttribute('aria-invalid')).toBe('true');
    expect(slug.matches(':focus')).toBe(true);
    expect(slug.getAttribute('autocomplete')).toBe('off');
    expect(slug.getAttribute('spellcheck')).toBe('false');
  });

  it('saves through the form and shows progress without losing the label', () => {
    vi.mocked(callSaveCollection).mockReturnValue(new Promise(() => {}));
    render(<AdminCollectionEditor collection={collection} posts={[]} />);
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save.getAttribute('type')).toBe('submit');
    expect(save).toHaveProperty('disabled', false);

    fill('Español', 'Título', 'El sonido en los juegos');
    fill('Español', 'Slug', 'el-sonido');
    expect(fireEvent.submit((save as HTMLButtonElement).form!)).toBe(false);

    expect(callSaveCollection).toHaveBeenCalledTimes(1);
    expect(save).toHaveProperty('disabled', true);
    expect(save.textContent).toBe('Guardar');
    expect(save.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(save.innerHTML).toContain('aria-hidden="true"');
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

  describe('members', () => {
    const member = (title: string): AdminMembershipPost => ({
      id: crypto.randomUUID(),
      section: 'analysis',
      title,
      localizations: [],
    });
    const members = [member('Primera'), member('Segunda'), member('Tercera')];
    const renderMembers = () =>
      render(
        <AdminCollectionEditor
          collection={{ ...collection, postIds: members.map(({ id }) => id) }}
          posts={members}
        />
      );
    const announcer = () => screen.getByText((_, element) => element?.id === 'members-status');

    it('names each action after the post it moves or removes', () => {
      renderMembers();
      expect(screen.getByRole('button', { name: 'Subir «Segunda»' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bajar «Segunda»' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Quitar «Segunda»' })).toBeTruthy();
    });

    it('keeps focus on the moved post and announces where it landed', () => {
      renderMembers();
      expect(announcer().getAttribute('role')).toBe('status');
      expect(announcer().textContent).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Bajar «Primera»' }));
      expect(screen.getByRole('button', { name: 'Bajar «Primera»' }).matches(':focus')).toBe(true);
      expect(announcer().textContent).toBe('«Primera» pasó a la posición 2 de 3.');

      // At the bottom its down button is disabled, so focus takes the other one.
      fireEvent.click(screen.getByRole('button', { name: 'Bajar «Primera»' }));
      expect(screen.getByRole('button', { name: 'Subir «Primera»' }).matches(':focus')).toBe(true);
      expect(announcer().textContent).toBe('«Primera» pasó a la posición 3 de 3.');
    });

    it('hands focus to the next post after a removal', () => {
      renderMembers();
      fireEvent.click(screen.getByRole('button', { name: 'Quitar «Primera»' }));
      expect(screen.queryByRole('button', { name: 'Quitar «Primera»' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Quitar «Segunda»' }).matches(':focus')).toBe(true);
      expect(announcer().textContent).toBe('«Primera» se quitó de la serie.');
    });
  });

  it('says when a new series could not be created', async () => {
    vi.mocked(callCreateCollection).mockRejectedValue(Error('offline'));
    render(<AdminCollections collections={[]} />);
    const create = screen.getByRole('button', { name: 'Nueva serie' });
    fireEvent.click(create);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo crear la serie. Intenta nuevamente.'
    );
    expect(create).toHaveProperty('disabled', false);
  });

  it('keeps the save region when a save fails', async () => {
    vi.mocked(callSaveCollection).mockResolvedValue({
      data: undefined,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'unexpected' },
    } as never);
    render(<AdminCollectionEditor collection={collection} posts={[]} />);
    // One region for the member list, one for the save.
    expect(screen.getAllByRole('status')).toHaveLength(2);

    fill('Español', 'Título', 'El sonido en los juegos');
    fill('Español', 'Slug', 'el-sonido');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudieron guardar los cambios.'
    );
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });
});
