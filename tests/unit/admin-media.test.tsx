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

import { mediaMetadataSchema } from '@/actions/media';
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => document.body.replaceChildren());

  it.each(['javascript:alert(1)', 'data:text/html,x'])('rejects unsafe metadata URL %s', (url) => {
    expect(() =>
      mediaMetadataSchema.parse({
        id: asset.id,
        decorative: false,
        altText: 'Mapa',
        sourceUrl: url,
      })
    ).toThrow();
  });

  it('renders a genuine empty first page', () => {
    render(<AdminMedia assets={[]} page={1} total={0} />);
    expect(screen.getByText('No hay imágenes todavía.')).toBeTruthy();
    expect(screen.queryByText('Anterior')).toBeNull();
  });

  it('renders the upload and metadata fields with the shared admin primitives', () => {
    render(<AdminMedia assets={[asset]} />);

    expect(screen.getAllByLabelText('Texto alternativo')[0]!.getAttribute('data-slot')).toBe(
      'input'
    );
    expect(screen.getByLabelText('Elegir imagen').getAttribute('data-slot')).toBe('input');
    expect(
      screen.getAllByRole('checkbox', { name: 'Imagen decorativa' })[0]!.getAttribute('data-slot')
    ).toBe('checkbox');
    fireEvent.click(screen.getByText('Editar metadatos'));
    expect(screen.getAllByLabelText('Texto alternativo')[1]!.getAttribute('data-slot')).toBe(
      'input'
    );
    expect(screen.getByRole('checkbox', { name: 'Trabajo propio' }).getAttribute('data-slot')).toBe(
      'checkbox'
    );
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
    // Named once, by its caption: the image would only repeat it.
    expect(screen.getByRole('button', { name: 'Mapa' })).toBeTruthy();

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
    fireEvent.click(view.getByRole('checkbox', { name: 'Imagen decorativa' }));
    fireEvent.change(view.getByLabelText('Elegir imagen'), {
      target: { files: [new File(['png'], 'mapa.png', { type: 'image/png' })] },
    });
    await view.findByRole('alert');
    expect(select).not.toHaveBeenCalled();
    expect((view.getByLabelText('Elegir imagen') as HTMLInputElement).value).toBe('');
  });

  it('sends a missing alt text back to its field instead of uploading', () => {
    render(<AdminMedia assets={[]} onSelect={vi.fn()} />);
    const alt = screen.getByLabelText('Texto alternativo');
    expect(alt.hasAttribute('aria-invalid')).toBe(false);

    fireEvent.change(screen.getByLabelText('Elegir imagen'), {
      target: { files: [new File(['png'], 'mapa.png', { type: 'image/png' })] },
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(alt.getAttribute('aria-invalid')).toBe('true');
    expect(alt.matches(':focus')).toBe(true);
    expect(alt.getAttribute('aria-describedby')).toBe(
      screen.getByText('Escribe el texto alternativo o marca la imagen como decorativa.').id
    );
    fireEvent.change(alt, { target: { value: 'Mapa' } });
    expect(alt.hasAttribute('aria-invalid')).toBe(false);
  });

  it('leaves the disabled state to the file input the label wraps', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    render(<AdminMedia assets={[]} onSelect={vi.fn()} />);
    const input = screen.getByLabelText('Elegir imagen') as HTMLInputElement;
    fireEvent.change(screen.getByLabelText('Texto alternativo'), { target: { value: 'Mapa' } });
    fireEvent.change(input, {
      target: { files: [new File(['png'], 'mapa.png', { type: 'image/png' })] },
    });

    expect(input.disabled).toBe(true);
    expect(
      screen.getByText('Elegir imagen', { selector: 'label' }).hasAttribute('aria-disabled')
    ).toBe(false);
  });

  it('labels every metadata field visibly and saves through the form', async () => {
    vi.mocked(callUpdateMediaAsset).mockReturnValue(new Promise(() => {}));
    render(<AdminMedia assets={[asset]} />);
    const form = (screen.getByRole('button', { name: 'Guardar metadatos' }) as HTMLButtonElement)
      .form!;
    const view = within(form);
    for (const name of ['URL de origen', 'URL de licencia']) {
      const field = view.getByLabelText(name) as HTMLInputElement;
      expect(field.hasAttribute('aria-label')).toBe(false);
      expect(view.getByText(name, { selector: 'label' })).toBeTruthy();
      expect(field.type).toBe('url');
      expect(field.inputMode).toBe('url');
    }
    expect(view.getByLabelText('Pie de imagen').hasAttribute('aria-label')).toBe(false);
    expect(view.getByText('Pie de imagen', { selector: 'label' })).toBeTruthy();
    const save = view.getByRole('button', { name: 'Guardar metadatos' });
    expect(save.getAttribute('type')).toBe('submit');

    expect(fireEvent.submit(form)).toBe(false);

    await waitFor(() => expect(save).toHaveProperty('disabled', true));
    expect(callUpdateMediaAsset).toHaveBeenCalledTimes(1);
    expect(save.textContent).toBe('Guardar metadatos');
    expect(save.innerHTML).toMatch(/<svg[^>]*animate-spin motion-reduce:animate-none/);
    expect(save.innerHTML).toContain('aria-hidden="true"');
  });

  it('preserves failed metadata and updates the standalone media card after success', async () => {
    vi.mocked(callUpdateMediaAsset)
      .mockResolvedValueOnce({ error: { code: 'INTERNAL_SERVER_ERROR' } } as never)
      .mockResolvedValueOnce({ data: { ...asset, altText: 'Mapa actualizado' } } as never);
    render(<AdminMedia assets={[asset]} />);
    fireEvent.click(screen.getByText('Editar metadatos'));
    const alt = screen.getAllByLabelText('Texto alternativo')[1]!;
    fireEvent.change(alt, { target: { value: 'Mapa actualizado' } });
    fireEvent.click(screen.getAllByText('Imagen decorativa', { exact: true })[1]!);
    fireEvent.click(screen.getByText('Trabajo propio', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metadatos' }));
    await screen.findByRole('alert');
    expect((alt as HTMLInputElement).value).toBe('Mapa actualizado');
    expect(vi.mocked(callUpdateMediaAsset).mock.calls[0]?.[0]).toMatchObject({
      decorative: true,
      isOwnWork: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar metadatos' }));
    await screen.findByText('Metadatos guardados.');
    expect(screen.getByText('Mapa actualizado')).toBeTruthy();
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

  it('uses compact selectable rows and links to the library in picker mode', () => {
    render(<AdminMedia assets={[asset]} onSelect={vi.fn()} />);

    const list = screen.getByRole('list');
    expect(list.className).toContain('grid-cols-1');
    expect(screen.getByRole('button', { name: 'Mapa' })).toBeTruthy();
    expect(screen.queryByText('Editar metadatos')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Ir a la biblioteca multimedia' }).getAttribute('href')
    ).toBe('/admin/media');
  });

  it('shows a card that selects nothing as content, not as a button', () => {
    render(<AdminMedia assets={[asset]} />);
    expect(screen.getByText('Mapa')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mapa/ })).toBeNull();
  });

  it('reports a page that failed to load apart from the upload', async () => {
    let fail = (_: Error) => {};
    vi.mocked(fetch).mockReturnValue(new Promise((_, reject) => (fail = reject)));
    render(<AdminMedia assets={[asset]} total={21} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    const list = screen.getByRole('list');
    expect(list.getAttribute('aria-busy')).toBe('true');
    // Loading a page is not an upload, so the upload stays available.
    expect((screen.getByLabelText('Elegir imagen') as HTMLInputElement).disabled).toBe(false);
    fail(Error('offline'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudo cargar esta página de imágenes. Intenta de nuevo.'
    );
    expect(list.getAttribute('aria-busy')).toBe('false');
  });

  it('reports failed metadata as an alert beside a region that stays', async () => {
    vi.mocked(callUpdateMediaAsset).mockResolvedValue({
      error: { code: 'INTERNAL_SERVER_ERROR' },
    } as never);
    render(<AdminMedia assets={[asset]} />);
    fireEvent.click(screen.getByText('Editar metadatos'));
    const region = screen.getByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar metadatos' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No se pudieron guardar los metadatos. Intenta de nuevo.'
    );
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('');
  });
});
