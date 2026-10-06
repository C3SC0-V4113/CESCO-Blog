// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callPublish: vi.fn(),
  callRenameLocalization: vi.fn(),
  callRetryPendingPurges: vi.fn(),
  callUnpublish: vi.fn(),
}));

import { AdminReview } from '@/components/admin/admin-review';
import { callRenameLocalization } from '@/lib/admin-actions';

import type { ReviewDetail } from '@/db/queries/admin-review';

const reload = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const detail = {
  postId: crypto.randomUUID(),
  localizationId: crypto.randomUUID(),
  locale: 'es',
  slug: 'una-publicacion',
  status: 'draft',
  title: 'Una publicación',
  draftToken: 'draft-token',
  coverAssetId: crypto.randomUUID(),
  firstPublishedAt: null,
  publishedRevisionId: null,
  contentJson: { type: 'doc', content: [] },
  referencedMedia: [],
} as unknown as ReviewDetail;

const renderReview = (overrides: Partial<ReviewDetail> = {}) =>
  render(
    <AdminReview
      items={[]}
      detail={{ ...detail, ...overrides }}
      page={1}
      pageSize={20}
      total={0}
      pendingPurges={0}
    />
  );

const slugField = () => screen.getByLabelText('Slug') as HTMLInputElement;

describe('AdminReview', () => {
  it('renames on Enter in the slug field instead of navigating', async () => {
    vi.mocked(callRenameLocalization).mockResolvedValue({
      data: { status: 'renamed' },
      error: undefined,
    } as never);
    renderReview();

    fireEvent.change(slugField(), { target: { value: 'nuevo-slug' } });
    // What the browser dispatches for Enter in the only text field of a form.
    const navigated = fireEvent.submit(slugField().form!);

    expect(navigated).toBe(false);
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(callRenameLocalization).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'nuevo-slug', acknowledgePermanentRedirect: false })
    );
    expect(screen.getByRole('button', { name: 'Cambiar slug' }).getAttribute('type')).toBe(
      'submit'
    );
    for (const name of ['Publicar', 'Despublicar'])
      expect(screen.getByRole('button', { name }).getAttribute('type')).toBe('button');
  });

  it('does not rename a published slug on Enter until the redirect is confirmed', () => {
    renderReview({ status: 'published', firstPublishedAt: '2026-08-01 12:00:00' });

    fireEvent.change(slugField(), { target: { value: 'nuevo-slug' } });
    expect(fireEvent.submit(slugField().form!)).toBe(false);

    expect(callRenameLocalization).not.toHaveBeenCalled();
  });

  it('keeps the rename label and shows progress while the request runs', () => {
    vi.mocked(callRenameLocalization).mockReturnValue(new Promise(() => {}));
    renderReview();
    const rename = screen.getByRole('button', { name: 'Cambiar slug' });
    expect(rename).toHaveProperty('disabled', false);

    fireEvent.change(slugField(), { target: { value: 'nuevo-slug' } });
    fireEvent.submit(slugField().form!);

    expect(rename).toHaveProperty('disabled', true);
    expect(rename.textContent).toBe('Cambiar slug');
    expect(rename.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(rename.innerHTML).toContain('aria-hidden="true"');
  });

  it('ties a missing redirect confirmation to its checkbox and focuses it', async () => {
    vi.mocked(callRenameLocalization).mockResolvedValue({
      data: { status: 'rejected', code: 'PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED' },
      error: undefined,
    } as never);
    // The server knows the localization went live after this page loaded.
    renderReview();

    fireEvent.change(slugField(), { target: { value: 'nuevo-slug' } });
    fireEvent.submit(slugField().form!);

    const checkbox = await screen.findByRole('checkbox', { name: /Confirmo/ });
    await waitFor(() => expect(checkbox.matches(':focus')).toBe(true));
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(checkbox.getAttribute('aria-describedby')).toBe(
      screen.getByText('Confirma la redirección permanente antes de cambiar el slug.').id
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('marks the slug as a plain identifier, not prose', () => {
    renderReview();
    expect(slugField().getAttribute('autocomplete')).toBe('off');
    expect(slugField().getAttribute('spellcheck')).toBe('false');
  });
});
