import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScrollSpy } from '@/hooks/use-scroll-spy';

describe('useScrollSpy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('observes the requested headings and activates the topmost intersecting one', () => {
    render(
      <>
        <h2 id="first">First</h2>
        <h2 id="second">Second</h2>
      </>
    );
    let notify: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
          notify = callback;
          expect(options).toEqual({ rootMargin: '0px 0px -66% 0px', threshold: 0 });
        }
        observe = observe;
        disconnect = disconnect;
      }
    );

    const ids = ['first', 'second'];
    const { result, unmount } = renderHook(() => useScrollSpy(ids));
    expect(observe).toHaveBeenCalledTimes(2);

    const entry = (id: string, top: number): IntersectionObserverEntry =>
      ({
        isIntersecting: true,
        target: screen.getByRole('heading', { name: id === 'first' ? 'First' : 'Second' }),
        boundingClientRect: { top } as DOMRectReadOnly,
      }) as unknown as IntersectionObserverEntry;
    act(() => notify?.([entry('second', 150), entry('first', 50)], {} as IntersectionObserver));

    expect(result.current).toBe('first');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
