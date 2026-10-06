import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreatePost: vi.fn(async () => ({ error: undefined })),
}));
import { AdminPostForm } from '@/components/admin/admin-post-form';
import { callCreatePost } from '@/lib/admin-actions';
import { createPostSchema } from '@/lib/admin-posts';

const submitSlug = (slug: string) => {
  fireEvent.change(screen.getByLabelText('Slug'), { target: { value: slug } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear publicación' }));
};

describe('admin post creation', () => {
  it('normalizes the slug and shows accessible validation', async () => {
    expect(
      createPostSchema.parse({ section: 'analysis', locale: 'es', slug: '  Primer Borrador  ' })
    ).toEqual({ section: 'analysis', locale: 'es', slug: 'primer-borrador' });
    expect(() =>
      createPostSchema.parse({ section: 'analysis', locale: 'es', slug: '---' })
    ).toThrow();
    const view = render(<AdminPostForm />);
    const slug = screen.getByLabelText('Slug');
    // Pointing at an element that is not rendered leaves a dangling reference.
    expect(slug.hasAttribute('aria-describedby')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Crear publicación' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Se necesita un slug válido.');
    expect(slug.getAttribute('aria-describedby')).toBe(alert.id);
    view.unmount();
    const { unmount } = render(
      <AdminPostForm createPost={vi.fn().mockRejectedValue(new Error('network'))} />
    );
    submitSlug('fallo');
    expect((await screen.findByRole('alert')).textContent).toContain('Intenta nuevamente.');
    unmount();
  });

  it('explains a reserved slug from the error code alone', async () => {
    const view = render(
      <AdminPostForm createPost={vi.fn().mockResolvedValue({ error: { code: 'CONFLICT' } })} />
    );
    submitSlug('reservado');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Ese slug ya está reservado para este idioma.');
    const slug = screen.getByLabelText('Slug');
    expect(slug.getAttribute('aria-invalid')).toBe('true');
    expect(slug.getAttribute('aria-describedby')).toBe(alert.id);
    expect(slug.matches(':focus')).toBe(true);
    view.unmount();
  });

  it('keeps the label and shows progress while the post is created', async () => {
    const view = render(
      <AdminPostForm createPost={vi.fn().mockReturnValue(new Promise(() => {}))} />
    );
    const create = screen.getByRole('button', { name: 'Crear publicación' });
    expect(create).toHaveProperty('disabled', false);
    submitSlug('en-curso');
    await waitFor(() => expect(create).toHaveProperty('disabled', true));
    expect(create.textContent).toBe('Crear publicación');
    expect(create.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(create.innerHTML).toContain('aria-hidden="true"');
    view.unmount();
  });

  it('marks the slug as a plain identifier, not prose', () => {
    const view = render(<AdminPostForm />);
    expect(screen.getByLabelText('Slug').getAttribute('spellcheck')).toBe('false');
    view.unmount();
  });

  it('returns to the post list once the post exists', async () => {
    const navigate = vi.fn();
    const view = render(<AdminPostForm navigate={navigate} />);
    submitSlug('  Primer Borrador  ');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/posts'));
    expect(callCreatePost).toHaveBeenCalledWith({
      section: 'analysis',
      locale: 'es',
      slug: 'primer-borrador',
    });
    view.unmount();
  });
});
