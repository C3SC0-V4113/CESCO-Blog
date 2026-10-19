import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callRetryPendingPurges: vi.fn(),
  callSetFeatured: vi.fn(),
}));

import { AdminPostList } from '@/components/admin/admin-post-list';
import { callSetFeatured } from '@/lib/admin-actions';

import type { AdminPostSummary } from '@/db/queries/admin-posts';

describe('AdminPostList', () => {
  it('opens a localization from its status and offers its SEO screen beside it', () => {
    const id = crypto.randomUUID();
    const es = crypto.randomUUID();
    render(
      <AdminPostList
        page={1}
        total={1}
        posts={[
          {
            id,
            section: 'analysis',
            editorialState: 'active',
            displayName: 'Una publicación',
            updatedAt: '2026-08-20 12:00:00',
            locales: { es: 'draft', en: 'missing' },
            localizationIds: { es },
            featured: {},
          },
        ]}
      />
    );

    // Every row repeats these links, so each names the post and locale it opens.
    expect(
      screen.getByRole('link', { name: 'Borrador: Una publicación (Español)' }).getAttribute('href')
    ).toBe(`/admin/posts/${id}/edit?localization=${es}`);
    expect(
      screen
        .getByRole('link', { name: 'SEO y redes: Una publicación (Español)' })
        .getAttribute('href')
    ).toBe(`/admin/posts/${id}/seo?localization=${es}`);
    // A localization that does not exist has nothing to open, and is not a
    // disabled control either.
    expect(screen.getByText('Sin crear').hasAttribute('aria-disabled')).toBe(false);
    expect(screen.queryByRole('link', { name: /Sin crear/ })).toBeNull();
  });

  const published = (featured: boolean): AdminPostSummary => ({
    id: crypto.randomUUID(),
    section: 'analysis',
    editorialState: 'active',
    displayName: 'Una publicación',
    updatedAt: '2026-08-20 12:00:00',
    locales: { es: 'published', en: 'missing' },
    localizationIds: { es: crypto.randomUUID() },
    featured: { es: featured },
  });

  it('names the table and heads each row with its post', () => {
    render(<AdminPostList page={1} total={1} posts={[published(false)]} />);
    expect(
      screen.getByRole('table', { name: 'Publicaciones y el estado de cada idioma' })
    ).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Una publicación' })).toBeTruthy();
  });

  it('keeps the feature toggle label fixed and reports its state as pressed', () => {
    render(<AdminPostList page={1} total={2} posts={[published(true), published(false)]} />);
    const [on, off] = screen.getAllByRole('button', {
      name: 'Destacar: Una publicación (Español)',
    });
    expect(on!.getAttribute('aria-pressed')).toBe('true');
    expect(off!.getAttribute('aria-pressed')).toBe('false');
  });

  it('says when featuring fails instead of silently resetting', async () => {
    vi.mocked(callSetFeatured).mockResolvedValue({
      data: undefined,
      error: { code: 'INTERNAL_SERVER_ERROR' },
    } as never);
    render(<AdminPostList page={1} total={1} posts={[published(false)]} />);
    fireEvent.click(screen.getByRole('button', { name: /Destacar/ }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo cambiar el destacado. Intenta nuevamente.'
    );
  });

  it('turns a cache warning into a separate retry, not a pressed toggle', async () => {
    vi.mocked(callSetFeatured).mockResolvedValue({
      data: { status: 'saved-with-cache-warning' },
      error: undefined,
    } as never);
    render(<AdminPostList page={1} total={1} posts={[published(false)]} />);
    fireEvent.click(screen.getByRole('button', { name: /Destacar/ }));
    const retry = await screen.findByRole('button', { name: /Reintentar actualización de caché/ });
    expect(retry.hasAttribute('aria-pressed')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Destacar/ })).toBeNull());
  });
});
