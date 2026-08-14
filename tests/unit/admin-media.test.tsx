import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/image-normalize', () => ({
  normalizeImage: vi.fn().mockResolvedValue({
    blob: new Blob(['webp'], { type: 'image/webp' }),
    width: 10,
    height: 10,
  }),
}));
vi.mock('@/lib/admin-actions', () => ({ callUpdateMediaAsset: vi.fn() }));

import { AdminMedia } from '@/components/admin/admin-media';
import { callUpdateMediaAsset } from '@/lib/admin-actions';

const asset = {
  id: crypto.randomUUID(),
  r2Key: 'media/2026/08/a.webp',
  altText: 'Mapa',
  caption: null,
  description: null,
  isOwnWork: false,
  creatorName: null,
  sourceUrl: null,
  licenseLabel: null,
  licenseUrl: null,
  contentType: 'image/webp',
  width: 10,
  height: 10,
  sizeBytes: 4,
  createdAt: '2026-08-13',
  updatedAt: '2026-08-13',
};

describe('AdminMedia', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => document.body.replaceChildren());

  it('renders a genuine empty first page', () => {
    render(<AdminMedia assets={[]} page={1} total={0} />);
    expect(screen.getByText('No hay imágenes todavía.')).toBeTruthy();
    expect(screen.queryByText('Anterior')).toBeNull();
  });

  it('normalizes and selects only after a successful upload', async () => {
    vi.mocked(fetch).mockImplementation(
      async () => new Response(JSON.stringify(asset), { status: 201 })
    );
    const select = vi.fn();
    render(<AdminMedia assets={[]} onSelect={select} />);
    fireEvent.change(screen.getByLabelText('Texto alternativo'), { target: { value: 'Mapa' } });
    fireEvent.change(screen.getByLabelText('Elegir imagen'), {
      target: { files: [new File(['png'], 'mapa.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(select).toHaveBeenCalledWith(asset));
    expect(screen.getByRole('img', { name: 'Mapa' })).toBeTruthy();

    const source = new File(['png'], 'mapa.png', { type: 'image/png' });
    const surface = screen.getByRole('region', { name: 'Carga de imagen' });
    fireEvent.paste(surface, { clipboardData: { files: [source] } });
    fireEvent.drop(surface, { dataTransfer: { files: [source] } });
    await waitFor(() => expect(select).toHaveBeenCalledTimes(3));
    fireEvent.paste(surface, {
      clipboardData: { files: [], getData: () => '<img src="https://remote">' },
    });
    expect(select).toHaveBeenCalledTimes(3);
  });

  it('does not select or mutate editor content after upload failure', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const select = vi.fn();
    const { container } = render(<AdminMedia assets={[]} onSelect={select} />);
    const view = within(container);
    fireEvent.click(view.getByLabelText('Imagen decorativa'));
    fireEvent.change(view.getByLabelText('Elegir imagen'), {
      target: { files: [new File(['png'], 'mapa.png', { type: 'image/png' })] },
    });
    await view.findByRole('alert');
    expect(select).not.toHaveBeenCalled();
    expect((view.getByLabelText('Elegir imagen') as HTMLInputElement).value).toBe('');
  });

  it('preserves failed metadata and publishes successful metadata to selection', async () => {
    vi.mocked(callUpdateMediaAsset)
      .mockResolvedValueOnce({ error: { code: 'INTERNAL_SERVER_ERROR' } } as never)
      .mockResolvedValueOnce({ data: { ...asset, altText: 'Mapa actualizado' } } as never);
    const select = vi.fn();
    render(<AdminMedia assets={[asset]} onSelect={select} />);
    fireEvent.click(screen.getByText('Editar metadatos'));
    const alt = screen.getAllByLabelText('Texto alternativo')[1]!;
    fireEvent.change(alt, { target: { value: 'Mapa actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metadatos' }));
    await screen.findByRole('alert');
    expect((alt as HTMLInputElement).value).toBe('Mapa actualizado');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metadatos' }));
    await screen.findByText('Metadatos guardados.');
    fireEvent.click(screen.getByRole('button', { name: /Mapa actualizado/ }));
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ altText: 'Mapa actualizado' }));
  });

  it('loads later picker pages without navigating the editor', async () => {
    const pageTwoId = crypto.randomUUID();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        assets: [
          { ...asset, id: pageTwoId, altText: 'Página dos' },
          { ...asset, id: pageTwoId, altText: 'Página dos' },
        ],
        total: 21,
      })
    );
    render(<AdminMedia assets={[asset]} total={21} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findAllByRole('button', { name: /Página dos/ })).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith('/admin/media/page.json?page=2');
  });
});
