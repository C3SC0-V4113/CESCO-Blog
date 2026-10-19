import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAsyncTransition } from '@/hooks/use-async-transition';

describe('useAsyncTransition', () => {
  it('releases an unresolved action when its component unmounts', async () => {
    const { result: pendingResult, unmount } = renderHook(() => useAsyncTransition());
    act(() => pendingResult.current[1](() => new Promise<void>(() => {})));
    expect(pendingResult.current[0]).toBe(true);

    unmount();

    const { result } = renderHook(() => useAsyncTransition());
    act(() => result.current[1](async () => {}));
    await waitFor(() => expect(result.current[0]).toBe(false));
  });
});
