// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callCreateAuthor: vi.fn(),
  callRetryPendingPurges: vi.fn(),
  callUpdateAuthor: vi.fn(),
}));

import { AdminAuthors } from '@/components/admin/admin-authors';
import { callUpdateAuthor } from '@/lib/admin-actions';

import type { AdminAuthor } from '@/db/queries/admin-taxonomy';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const author = {
  id: crypto.randomUUID(),
  slug: 'cesco',
  name: 'Cesco',
  bio: null,
  avatarMediaId: null,
  websiteUrl: null,
  sameAs: [],
} as unknown as AdminAuthor;

// The page opens with the blank "new author" form, then one form per author.
const renderAuthors = () => render(<AdminAuthors authors={[author]} media={[]} />);
const existing = <T,>(elements: T[]) => elements[1]!;

describe('AdminAuthors', () => {
  it('saves through the form, so Enter in any field submits it', async () => {
    vi.mocked(callUpdateAuthor).mockResolvedValue({
      data: { status: 'saved' },
      error: undefined,
    } as never);
    renderAuthors();
    const save = existing(screen.getAllByRole('button', { name: 'Guardar' })) as HTMLButtonElement;
    expect(save.type).toBe('submit');

    expect(fireEvent.submit(save.form!)).toBe(false);

    await waitFor(() =>
      expect(callUpdateAuthor).toHaveBeenCalledWith(
        expect.objectContaining({ id: author.id, slug: 'cesco', name: 'Cesco' })
      )
    );
  });

  it('keeps the label and shows progress while a save runs', () => {
    vi.mocked(callUpdateAuthor).mockReturnValue(new Promise(() => {}));
    renderAuthors();
    const save = existing(screen.getAllByRole('button', { name: 'Guardar' })) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    fireEvent.submit(save.form!);

    expect(save.disabled).toBe(true);
    expect(save.textContent).toBe('Guardar');
    expect(save.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(save.innerHTML).toContain('aria-hidden="true"');
  });

  it('describes the related profiles format and keeps identifiers out of spellcheck', () => {
    renderAuthors();
    const [blank, sameAs] = screen.getAllByLabelText('Perfiles relacionados');
    const [blankHelp, help] = screen.getAllByText('Una URL por línea.');
    // One help text per form, each pointed at by its own field.
    expect(blank!.getAttribute('aria-describedby')).toBe(blankHelp!.id);
    expect(sameAs!.getAttribute('aria-describedby')).toBe(help!.id);
    expect(help!.id).not.toBe(blankHelp!.id);
    expect(sameAs!.getAttribute('spellcheck')).toBe('false');
    const slug = existing(screen.getAllByLabelText('Slug'));
    expect(slug.getAttribute('autocomplete')).toBe('off');
    expect(slug.getAttribute('spellcheck')).toBe('false');
    expect(existing(screen.getAllByLabelText('Nombre')).getAttribute('autocomplete')).toBe('off');
  });

  it('keeps the polite region of each form and inserts a failure beside it', async () => {
    vi.mocked(callUpdateAuthor).mockResolvedValue({
      data: undefined,
      error: { code: 'INTERNAL_SERVER_ERROR' },
    } as never);
    renderAuthors();
    const region = existing(screen.getAllByRole('status'));
    fireEvent.submit(
      (existing(screen.getAllByRole('button', { name: 'Guardar' })) as HTMLButtonElement).form!
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudieron guardar los cambios.'
    );
    expect(existing(screen.getAllByRole('status'))).toBe(region);
    expect(region.textContent).toBe('');
  });
});
