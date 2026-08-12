import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreatePost: vi.fn(async () => ({ error: undefined })),
}));
import { AdminPostForm } from '@/components/admin/admin-post-form';
import { createPostSchema } from '@/lib/admin-posts';
describe('admin post creation', () => {
  it('normalizes the slug and shows accessible validation', async () => {
    expect(
      createPostSchema.parse({ section: 'analysis', locale: 'es', slug: '  Primer Borrador  ' })
    ).toEqual({ section: 'analysis', locale: 'es', slug: 'primer-borrador' });
    expect(() =>
      createPostSchema.parse({ section: 'analysis', locale: 'es', slug: '---' })
    ).toThrow();
    const view = render(<AdminPostForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear publicación' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ingresa un slug válido.');
    view.unmount();
    render(<AdminPostForm createPost={vi.fn().mockRejectedValue(new Error('network'))} />);
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'fallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear publicación' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Intenta nuevamente.');
  });
});
