import { describe, expect, it, vi } from 'vitest';

import { drainBody } from '@/lib/request-body';

describe('drainBody', () => {
  it('cancels declared and streamed bodies above the rejection limit', async () => {
    const cancel = vi.fn();
    const body = () =>
      new ReadableStream({
        pull: (controller) => controller.enqueue(new Uint8Array(9_000)),
        cancel,
      });
    await drainBody(body(), 9_000);
    await drainBody(body(), Number.NaN);
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
