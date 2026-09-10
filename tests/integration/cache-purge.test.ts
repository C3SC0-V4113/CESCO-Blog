import { describe, expect, it, vi } from 'vitest';

import { makeCachePurger } from '@/actions/cache-purge';

const tags = ['post-1', 'section-analysis', 'locale-es', 'rss', 'sitemap'];

describe('cache purge adapter', () => {
  it('fails closed when local mode is used outside loopback', () => {
    expect(() =>
      makeCachePurger(new Request('https://example.com/admin'), {
        mode: 'local',
        zoneId: '',
        token: '',
      })
    ).toThrow('local-cache-purge-mode-outside-localhost');
  });

  it('requires production credentials and sends one exact tag batch', async () => {
    const request = new Request('https://admin.example.com/admin');
    expect(() => makeCachePurger(request, { mode: 'cloudflare', zoneId: '', token: '' })).toThrow(
      'cache-purge-not-configured'
    );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await makeCachePurger(
      request,
      { mode: 'cloudflare', zoneId: 'zone/id', token: 'secret' },
      fetcher
    )(tags);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      'https://api.cloudflare.com/client/v4/zones/zone%2Fid/purge_cache',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tags }),
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      })
    );
  });

  it.each([
    ['negative result', new Response(JSON.stringify({ success: false }))],
    ['missing result', new Response('{}')],
    ['wrong result shape', new Response(JSON.stringify({ success: 'true' }))],
    ['malformed result', new Response('{')],
    ['HTTP failure', new Response(JSON.stringify({ success: true }), { status: 503 })],
  ])('rejects a %s instead of reporting a completed purge', async (_, response) => {
    const purge = makeCachePurger(
      new Request('https://admin.example.com/admin'),
      { mode: 'cloudflare', zoneId: 'zone', token: 'secret' },
      vi.fn<typeof fetch>().mockResolvedValue(response)
    );

    await expect(purge(tags)).rejects.toThrow('cache-purge-failed');
  });
});
