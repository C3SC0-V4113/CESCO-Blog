import { describe, expect, it, vi } from 'vitest';

import { DraftAutosave } from '@/lib/draft-autosave';

describe('draft autosave', () => {
  it('debounces, serializes, coalesces, flushes, and halts on conflict', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockRejectedValueOnce({ error: { code: 'CONFLICT' } });
    const autosave = new DraftAutosave(save, 1_000);
    autosave.change({ title: 'one' });
    autosave.change({ title: 'two' });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledOnce();
    autosave.change({ title: 'three' });
    release();
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls.map(([value]) => value.title)).toEqual(['two', 'three']);
    expect(autosave.status).toBe('conflict');
    autosave.change({ title: 'ignored' });
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('flushes immediately and retries the exact failed payload', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
    const autosave = new DraftAutosave(save);
    const payload = { title: 'first' };
    autosave.change(payload);
    await autosave.flush();
    expect(save).toHaveBeenCalledOnce();
    expect(autosave.status).toBe('failed');
    await expect(autosave.flush()).resolves.toBe(true);
    expect(save.mock.calls.map(([value]) => value)).toEqual([payload, payload]);
    expect(autosave.status).toBe('saved');
  });
});
