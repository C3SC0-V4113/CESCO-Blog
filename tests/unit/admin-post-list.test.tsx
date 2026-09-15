// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({
  callRetryPendingPurges: vi.fn(),
  callSetFeatured: vi.fn(),
}));

import { AdminPostList } from '@/components/admin/admin-post-list';

afterEach(cleanup);

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

    expect(screen.getByRole('link', { name: 'Borrador' }).getAttribute('href')).toBe(
      `/admin/posts/${id}/edit?localization=${es}`
    );
    expect(screen.getByRole('link', { name: 'SEO y redes' }).getAttribute('href')).toBe(
      `/admin/posts/${id}/seo?localization=${es}`
    );
    // A localization that does not exist has nothing to open.
    expect(screen.getByText('Sin crear')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sin crear' })).toBeNull();
  });
});
