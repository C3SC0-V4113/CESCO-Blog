// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callRetryPendingPurges: vi.fn(),
  callSaveSeoDraft: vi.fn(),
}));

import { AdminSeo } from '@/components/admin/admin-seo';
import { callSaveSeoDraft } from '@/lib/admin-actions';

import type { AdminSeoState } from '@/db/queries/admin-taxonomy';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const seo: AdminSeoState = {
  postId: crypto.randomUUID(),
  localizationId: crypto.randomUUID(),
  locale: 'es',
  slug: 'una-publicacion',
  section: 'analysis',
  authorId: null,
  coverMediaId: null,
  title: 'Una publicación',
  excerpt: null,
  contentJson: { type: 'doc', content: [] },
  draftToken: 'publish-token-seeded',
  seoTitle: null,
  seoDescription: null,
  ogTitle: null,
  ogDescription: null,
  ogImageMediaId: null,
  ogImageAlt: null,
};

const renderSeo = () =>
  render(<AdminSeo seo={seo} authors={[]} media={[]} canonical="https://example.com/es/a" />);

describe('AdminSeo', () => {
  it('replays a save whose response was lost with the same tokens', async () => {
    vi.mocked(callSaveSeoDraft)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ data: { status: 'saved' }, error: undefined } as never);
    renderSeo();

    fireEvent.change(screen.getByLabelText('Título SEO'), { target: { value: 'Título SEO' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('No se pudieron guardar los cambios.')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Cambios guardados.'));

    // Exactly the lost attempt again: nothing newer was edited, so nothing new goes out.
    expect(callSaveSeoDraft).toHaveBeenCalledTimes(2);
    const [[first], [second]] = vi.mocked(callSaveSeoDraft).mock.calls;
    expect(first).toMatchObject({
      draftToken: 'publish-token-seeded',
      nextToken: expect.stringMatching(/^[0-9a-f-]{36}$/),
      seoTitle: 'Título SEO',
    });
    expect(second).toEqual(first);
  });

  it('says why a live post cannot lose its cover', async () => {
    vi.mocked(callSaveSeoDraft).mockResolvedValue({
      data: undefined,
      error: { code: 'BAD_REQUEST', message: 'cover-required-while-published' },
    } as never);
    renderSeo();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'La portada no se puede quitar mientras algún idioma de la publicación esté publicado.'
      )
    );
    const cover = screen.getByLabelText('Portada editorial limpia');
    expect(cover.getAttribute('aria-invalid')).toBe('true');
    expect(cover.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(cover.matches(':focus')).toBe(true);
  });

  it('saves through the form and shows progress without losing the label', () => {
    vi.mocked(callSaveSeoDraft).mockReturnValue(new Promise(() => {}));
    renderSeo();
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save.getAttribute('type')).toBe('submit');
    expect(save).toHaveProperty('disabled', false);

    expect(fireEvent.submit((save as HTMLButtonElement).form!)).toBe(false);

    expect(callSaveSeoDraft).toHaveBeenCalledTimes(1);
    expect(save).toHaveProperty('disabled', true);
    expect(save.textContent).toBe('Guardar');
    expect(save.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(save.innerHTML).toContain('aria-hidden="true"');
  });

  it('stops at a conflict instead of overwriting the other session', async () => {
    vi.mocked(callSaveSeoDraft).mockResolvedValue({
      data: undefined,
      error: { code: 'CONFLICT', message: '' },
    } as never);
    renderSeo();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'El borrador cambió en otra sesión. Recarga para continuar.'
      )
    );
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveProperty('disabled', true);
  });
});
