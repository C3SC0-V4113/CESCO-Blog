// Vitest globals are disabled, so Testing Library cannot register automatic cleanup.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup, isInaccessible, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Breadcrumb, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Pagination, PaginationEllipsis } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

afterEach(cleanup);

describe('registry primitives', () => {
  it('announces the pagination gap instead of hiding it with its glyph', () => {
    render(
      <Pagination aria-label="Paginación">
        <PaginationEllipsis srLabel="Más páginas" />
      </Pagination>
    );

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    // A `<nav>` is a navigation landmark on its own; the role attribute only
    // repeated it.
    expect(nav.hasAttribute('role')).toBe(false);

    expect(isInaccessible(screen.getByText('Más páginas'))).toBe(false);
  });

  it('marks the current crumb with aria-current alone, not as a dead link', () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbPage>Current article</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>
    );

    const current = screen.getByText('Current article');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.hasAttribute('role')).toBe(false);
    expect(current.hasAttribute('aria-disabled')).toBe(false);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('names the sheet close button from the label it is given', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent closeLabel="Cerrar">
          <SheetTitle>Menú</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});
