// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreatePost: vi.fn(),
  callPublish: vi.fn(),
  callRetryPendingPurges: vi.fn(),
  callUnpublish: vi.fn(),
  callRenameLocalization: vi.fn(),
}));

import { AdminApp } from '@/components/admin/admin-app';
import { callPublish, callRenameLocalization, callRetryPendingPurges } from '@/lib/admin-actions';

afterEach(cleanup);

describe('AdminApp', () => {
  it('keeps every control inert until React has hydrated the page', () => {
    // The server markup is what an editor can type into before hydration, and
    // React resets controlled inputs to it when it commits.
    expect(renderToString(<AdminApp screen={{ name: 'new-post' }} />)).toContain(
      '<fieldset disabled="" class="contents">'
    );

    render(<AdminApp screen={{ name: 'new-post' }} />);
    expect(screen.getByRole('button', { name: 'Crear publicación' })).toHaveProperty(
      'disabled',
      false
    );
  });

  it('renders an honest dashboard with live taxonomy destinations', () => {
    render(<AdminApp />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Panel editorial');
    for (const heading of [/Borradores/, /Idiomas/, /Actividad/]) {
      const section = screen.getByRole('region', { name: heading });
      expect(within(section).getByText(/No hay datos disponibles/)).toBeTruthy();
    }
    const trigger = screen.getByRole('button', { name: /Abrir navegaci/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation', { name: /Administraci/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Publicaciones' }).getAttribute('href')).toBe(
      '/admin/posts'
    );
    expect(screen.getByRole('link', { name: 'Multimedia' }).getAttribute('href')).toBe(
      '/admin/media'
    );
    expect(screen.getByRole('link', { name: /Revisi/ }).getAttribute('href')).toBe('/admin/review');
    expect(screen.getByRole('link', { name: 'Series' }).getAttribute('href')).toBe(
      '/admin/collections'
    );
    expect(screen.getByRole('link', { name: 'Autores' }).getAttribute('href')).toBe(
      '/admin/authors'
    );
  });

  it('shows server-owned review detail and publishes it with a stable operation id', async () => {
    vi.mocked(callPublish).mockResolvedValue({ data: undefined, error: Error('offline') } as never);
    const postId = crypto.randomUUID(),
      localizationId = crypto.randomUUID();
    render(
      <AdminApp
        screen={{
          name: 'review',
          page: 2,
          total: 51,
          pageSize: 50,
          pendingPurges: 0,
          items: [
            {
              postId,
              localizationId,
              locale: 'es',
              slug: 'publicable',
              status: 'draft',
              section: 'analysis',
              title: 'Publicable',
              draftToken: 'token',
              coverReady: true,
            },
          ],
          detail: {
            postId,
            localizationId,
            locale: 'es',
            slug: 'publicable',
            status: 'draft',
            section: 'analysis',
            editorialState: 'active',
            publishedRevisionId: null,
            firstPublishedAt: null,
            coverMediaId: crypto.randomUUID(),
            coverAssetId: crypto.randomUUID(),
            title: 'Publicable',
            excerpt: null,
            contentJson: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  attrs: { blockId: 'paragraph' },
                  content: [{ type: 'text', text: 'Cuerpo exacto revisado' }],
                },
                {
                  type: 'codeBlock',
                  attrs: { blockId: 'code', language: 'javascript' },
                  content: [{ type: 'text', text: 'const reviewed = true;' }],
                },
                {
                  type: 'image',
                  attrs: { blockId: 'image', mediaAssetId: 'asset', alt: 'Imagen revisada' },
                },
              ],
            },
            seoTitle: null,
            seoDescription: null,
            canonicalUrl: null,
            ogTitle: null,
            ogDescription: null,
            ogImageMediaId: null,
            ogImageAlt: null,
            draftToken: 'token',
            referencedMedia: [
              {
                id: 'asset',
                r2Key: 'media/2026/08/asset.webp',
                altText: 'Imagen canónica',
                caption: null,
                description: null,
                isOwnWork: true,
                creatorName: null,
                sourceUrl: null,
                licenseLabel: null,
                licenseUrl: null,
                contentType: 'image/webp',
                width: 800,
                height: 600,
                sizeBytes: 100,
                createdAt: '2026-08-14 12:00:00',
                updatedAt: '2026-08-14 12:00:00',
              },
            ],
          },
        }}
      />
    );
    expect(screen.getByText('Cuerpo exacto revisado')).toBeTruthy();
    expect(screen.getByText('const reviewed = true;')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Imagen revisada' }).getAttribute('src')).toBe(
      '/media/2026/08/asset.webp'
    );
    expect(screen.queryByRole('checkbox', { name: /Confirmo/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar slug' })).toHaveProperty('disabled', false);
    // Nothing is pending, so there is nothing to retry.
    expect(screen.queryByRole('button', { name: /Reintentar actualizaci/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(callPublish).toHaveBeenCalledTimes(2));
    // A retry after a lost response replays the same operation instead of
    // publishing a second revision.
    const [[first], [second]] = vi.mocked(callPublish).mock.calls;
    expect(second).toEqual(first);
    expect(first).toMatchObject({ postId, localizationId, draftToken: 'token' });
    expect(screen.getByText(/51–51 de 51/)).toBeTruthy();
    const previous = screen.getByRole('link', { name: 'Anterior' }).getAttribute('href');
    expect(previous).toContain('page=1');
    expect(previous).toContain(`post=${postId}`);
    expect(previous).toContain(`localization=${localizationId}`);
  });

  it('requires acknowledgement before renaming an ever-published localization', async () => {
    vi.mocked(callRenameLocalization).mockResolvedValue({
      data: { status: 'renamed-with-cache-warning' },
    } as never);
    const postId = crypto.randomUUID(),
      localizationId = crypto.randomUUID();
    render(
      <AdminApp
        screen={{
          name: 'review',
          items: [],
          page: 1,
          total: 0,
          pageSize: 50,
          pendingPurges: 0,
          detail: {
            postId,
            localizationId,
            locale: 'es',
            slug: 'publicado',
            status: 'published',
            section: 'analysis',
            editorialState: 'active',
            publishedRevisionId: crypto.randomUUID(),
            firstPublishedAt: '2026-08-14 12:00:00',
            coverMediaId: null,
            coverAssetId: null,
            title: 'Publicado',
            excerpt: null,
            contentJson: { type: 'doc', content: [] },
            seoTitle: null,
            seoDescription: null,
            canonicalUrl: null,
            ogTitle: null,
            ogDescription: null,
            ogImageMediaId: null,
            ogImageAlt: null,
            draftToken: 'token',
            referencedMedia: [],
          },
        }}
      />
    );
    const rename = screen.getByRole('button', { name: 'Cambiar slug' });
    const slug = screen.getByLabelText('Slug');
    const confirmation = screen.getByRole('checkbox', { name: /Confirmo/ });
    expect(screen.getByText(/Esta localización ya se publicó/)).toBeTruthy();
    expect(rename).toHaveProperty('disabled', true);
    fireEvent.change(slug, { target: { value: 'nuevo-slug' } });
    fireEvent.click(confirmation);
    expect(rename).toHaveProperty('disabled', false);
    fireEvent.change(slug, { target: { value: 'publicado' } });
    expect(confirmation).toHaveProperty('checked', false);
    expect(rename).toHaveProperty('disabled', true);
    fireEvent.change(slug, { target: { value: 'nuevo-slug' } });
    fireEvent.click(confirmation);
    fireEvent.click(rename);
    await waitFor(() =>
      expect(callRenameLocalization).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgePermanentRedirect: true })
      )
    );
    await waitFor(() => expect(confirmation).toHaveProperty('checked', false));
  });

  it('uses the serialized action result code when publication interleaves before rename', async () => {
    vi.mocked(callRenameLocalization).mockResolvedValue({
      data: {
        status: 'rejected',
        code: 'PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED',
      },
      error: undefined,
    } as never);
    render(
      <AdminApp
        screen={{
          name: 'review',
          items: [],
          page: 1,
          total: 0,
          pageSize: 50,
          pendingPurges: 0,
          detail: {
            postId: crypto.randomUUID(),
            localizationId: crypto.randomUUID(),
            locale: 'es',
            slug: 'aun-no-publicado',
            status: 'draft',
            section: 'analysis',
            editorialState: 'active',
            publishedRevisionId: null,
            firstPublishedAt: null,
            coverMediaId: crypto.randomUUID(),
            coverAssetId: crypto.randomUUID(),
            title: 'Intercalado',
            excerpt: null,
            contentJson: { type: 'doc', content: [] },
            seoTitle: null,
            seoDescription: null,
            canonicalUrl: null,
            ogTitle: null,
            ogDescription: null,
            ogImageMediaId: null,
            ogImageAlt: null,
            draftToken: 'token',
            referencedMedia: [],
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar slug' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Confirma la redirección permanente')
    );
    expect(callRenameLocalization).toHaveBeenCalledWith(
      expect.objectContaining({ acknowledgePermanentRedirect: false })
    );
  });

  it('offers a retry for cache purges that earlier changes left pending', async () => {
    vi.mocked(callRetryPendingPurges).mockResolvedValue({
      data: { status: 'pending' },
      error: undefined,
    } as never);
    render(
      <AdminApp
        screen={{
          name: 'review',
          items: [],
          detail: null,
          page: 1,
          total: 0,
          pageSize: 50,
          pendingPurges: 2,
        }}
      />
    );

    expect(screen.getByText(/caché no se actualizó/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar actualizaci/ }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('sigue sin actualizarse')
    );
    expect(callRetryPendingPurges).toHaveBeenCalledOnce();
  });
});
