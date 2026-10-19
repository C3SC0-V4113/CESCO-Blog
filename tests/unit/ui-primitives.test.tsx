import { isInaccessible, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Breadcrumb, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationEllipsis } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

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

  it('gives form controls a full focus ring that stays distinct from invalid styling', () => {
    render(
      <>
        <label>
          Input <Input aria-invalid="true" />
        </label>
        <label>
          Textarea <Textarea aria-invalid="true" />
        </label>
        <Button aria-invalid="true">Save</Button>
        <Select value="">
          <SelectTrigger aria-label="Select" aria-invalid="true">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
        </Select>
        <Checkbox aria-label="Checkbox" aria-invalid="true" />
        <FieldLabel>Grouped checkbox</FieldLabel>
      </>
    );

    const controls = [
      screen.getByRole('textbox', { name: 'Input' }),
      screen.getByRole('textbox', { name: 'Textarea' }),
      screen.getByRole('button', { name: 'Save' }),
      screen.getByRole('combobox', { name: 'Select' }),
      screen.getByRole('checkbox', { name: 'Checkbox' }),
    ];

    for (const control of controls) {
      const classes = control.className;
      expect(classes).toMatch(/focus-visible:ring-ring(?:\s|$)/);
      expect(classes).not.toMatch(/ring-ring\/\d/);
      expect(classes).not.toMatch(/aria-invalid:ring-(?:destructive|ring)/);
    }

    const labelClasses = screen.getByText('Grouped checkbox').className;
    expect(labelClasses).toContain('has-[:focus-visible]:ring-ring');
    expect(labelClasses).not.toMatch(/ring-ring\/\d/);
  });
});
