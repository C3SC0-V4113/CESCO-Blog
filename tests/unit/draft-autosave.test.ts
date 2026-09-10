import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDraftSave, DraftAutosave } from '@/lib/draft-autosave';

afterEach(() => vi.useRealTimers());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  it('holds every overlapping flush until the follow-up save settles', async () => {
    const releases: Array<() => void> = [];
    const save = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    // Long enough that the debounce never fires: every save here goes through flush.
    const autosave = new DraftAutosave(save, 60_000);
    const settled: string[] = [];
    const track = (name: string, flushed: Promise<boolean>) =>
      flushed.then((saved) => {
        settled.push(name);
        return saved;
      });
    autosave.change({ title: 'one' });
    const started = track('started', autosave.flush());
    autosave.change({ title: 'two' });
    const first = track('first', autosave.flush());
    const second = track('second', autosave.flush());
    releases[0]?.();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(settled).toEqual([]);
    releases[1]?.();
    await expect(Promise.all([started, first, second])).resolves.toEqual([true, true, true]);
    expect(autosave.status).toBe('saved');
  });

  it('reports an invalid edit as failed until the next valid edit', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockResolvedValue(undefined);
    const autosave = new DraftAutosave(save, 1_000);
    autosave.change({ title: 'valid' });
    await vi.advanceTimersByTimeAsync(1_000);
    autosave.change({ title: 'superseded' });
    autosave.markInvalid();
    expect(autosave.status).toBe('failed');
    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(save).toHaveBeenCalledOnce();
    expect(autosave.status).toBe('failed');
    await expect(autosave.flush()).resolves.toBe(false);
    autosave.change({ title: 'fixed' });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(save.mock.calls.map(([value]) => value.title)).toEqual(['valid', 'fixed']);
    expect(autosave.status).toBe('saved');
  });
});

describe('draft save attempts', () => {
  it('retries a failed attempt with its token and adopts the token once it lands', async () => {
    const tokens = ['b', 'c'];
    const send = vi.fn().mockRejectedValueOnce(Error('response lost')).mockResolvedValue(undefined);
    const save = createDraftSave('a', send, () => tokens.shift() ?? 'unexpected');
    const first = { title: 'one' };
    const second = { title: 'two' };
    await expect(save(first)).rejects.toThrow('response lost');
    await save(first);
    await save(second);
    expect(send.mock.calls).toEqual([
      [first, { draftToken: 'a', nextToken: 'b' }],
      [first, { draftToken: 'a', nextToken: 'b' }],
      [second, { draftToken: 'b', nextToken: 'c' }],
    ]);
  });

  it('lands an unconfirmed attempt before sending a newer edit under a fresh token', async () => {
    const tokens = ['b', 'c'];
    const send = vi.fn().mockRejectedValueOnce(Error('response lost')).mockResolvedValue(undefined);
    const save = createDraftSave(null, send, () => tokens.shift() ?? 'unexpected');
    const first = { title: 'one' };
    const second = { title: 'two' };
    await expect(save(first)).rejects.toThrow('response lost');
    await save(second);
    expect(send.mock.calls).toEqual([
      [first, { draftToken: null, nextToken: 'b' }],
      [first, { draftToken: null, nextToken: 'b' }],
      [second, { draftToken: 'b', nextToken: 'c' }],
    ]);
  });
});
