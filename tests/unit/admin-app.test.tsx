import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-actions', () => ({ callCreatePost: vi.fn() }));

import { AdminApp } from '@/components/admin/admin-app';

describe('AdminApp', () => {
  it('renders an honest dashboard and keeps future destinations non-interactive', () => {
    render(<AdminApp />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Panel editorial');

    for (const heading of ['Borradores en curso', 'Idiomas sin publicar', 'Actividad reciente']) {
      const section = screen.getByRole('region', { name: heading });
      expect(within(section).getByText('No hay datos disponibles todavía.')).toBeTruthy();
    }

    const trigger = screen.getByRole('button', { name: 'Abrir navegación' });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation', { name: 'Administración' })).toBeTruthy();

    expect(screen.getByRole('link', { name: 'Publicaciones' }).getAttribute('href')).toBe(
      '/admin/posts'
    );
    for (const label of ['Multimedia', 'Revisión', 'Series', 'Autores']) {
      expect(screen.getByRole('button', { name: label })).toHaveProperty('disabled', true);
    }
  });
});
