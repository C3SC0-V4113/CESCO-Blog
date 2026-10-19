import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LocaleSwitcher from '@/components/nav/locale-switcher';
import ThemeToggle from '@/components/nav/theme-toggle';
import TocScrollSpy from '@/components/post/toc-scroll-spy';

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

/** The injected rule that holds every transition still for the swap, if present. */
function swapSuppression() {
  return [...document.head.querySelectorAll('style')].find((style) =>
    style.textContent?.includes('transition:none')
  );
}

describe('theme toggle', () => {
  it('suppresses transitions for the frame the theme flips in', () => {
    // Held so the test can look at the document between the flip and the next
    // frame, which is exactly where a colour smear would be painted.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    render(<ThemeToggle label="Cambiar tema" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tema' }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(swapSuppression()).toBeDefined();

    for (const frame of frames) frame(performance.now());

    expect(swapSuppression()).toBeUndefined();
  });
});

describe('locale switcher', () => {
  const options = [
    { locale: 'es', label: 'Español', href: '/es/analisis/uno', current: true },
    { locale: 'en', label: 'English', href: '/en/analysis/one', current: false },
  ];

  it('names the trigger with the label it shows (WCAG 2.5.3)', () => {
    render(<LocaleSwitcher triggerLabel="Cambiar idioma" options={options} />);

    // A speech user says what they see. "Español" is on screen from `sm` up,
    // so it has to be part of the name, not replaced by it.
    expect(screen.getByRole('button', { name: 'Cambiar idioma: Español' })).toBeTruthy();
  });

  it('tags each option with its language and marks the current one', async () => {
    render(<LocaleSwitcher triggerLabel="Cambiar idioma" options={options} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar idioma: Español' }));

    const english = await screen.findByRole('menuitem', { name: 'English' });
    const spanish = screen.getByRole('menuitem', { name: 'Español' });

    // `lang` so "English" is pronounced as English inside a Spanish page.
    expect(english.getAttribute('lang')).toBe('en');
    expect(english.getAttribute('hreflang')).toBe('en');
    expect(english.hasAttribute('aria-current')).toBe(false);

    expect(spanish.getAttribute('lang')).toBe('es');
    expect(spanish.getAttribute('aria-current')).toBe('page');
  });
});

describe('table of contents scroll spy', () => {
  it('closes the mobile outline when one of its links is followed', () => {
    // jsdom has no IntersectionObserver; the highlight is not under test here.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );

    render(
      <>
        <details open>
          <summary>Contenido</summary>
          <a href="#intro" data-toc-link="intro">
            Intro
          </a>
        </details>
        <h2 id="intro">Intro</h2>
        <TocScrollSpy ids={['intro']} />
      </>
    );

    // Open is the state a reader is in just before choosing a heading; left
    // that way, the sticky outline sits on top of the heading they jumped to.
    const outline = screen.getByRole('group');
    expect(outline.hasAttribute('open')).toBe(true);

    fireEvent.click(screen.getByRole('link', { name: 'Intro' }));

    expect(outline.hasAttribute('open')).toBe(false);
  });
});
