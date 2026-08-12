import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { drainBody } from '@/lib/request-body';

const root = process.cwd();

describe('admin route boundary', () => {
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

  it('hydrates the admin application without replacing Astro-owned HTML', () => {
    const route = readFileSync(join(root, 'src/pages/admin/index.astro'), 'utf8');
    const middleware = readFileSync(join(root, 'src/middleware.ts'), 'utf8');

    expect(route).toContain('<AdminApp client:load />');
    expect(route).not.toContain('client:only');
    expect(middleware).toContain("context.url.pathname === '/admin'");
    expect(middleware).toContain("context.url.pathname.startsWith('/admin/')");
    expect(middleware).not.toMatch(/from ['"].*(auth|session)|cookies?\./i);
    const actions = readFileSync(join(root, 'src/actions/index.ts'), 'utf8');
    expect(actions).toMatch(/server\s*=\s*{\s*admin:\s*{/s);
    expect(actions).not.toMatch(/server\s*=\s*{\s*(?!admin:)[a-zA-Z]+:/s);
  });

  it('does not reverse the admin dependency direction from public chrome', () => {
    const publicSources = [
      'src/layouts/main.astro',
      'src/components/common/site-header.astro',
      'src/components/common/site-footer.astro',
    ].map((path) => readFileSync(join(root, path), 'utf8'));

    for (const source of publicSources) {
      expect(source).not.toMatch(/components\/admin|@\/components\/admin/);
    }
  });
});
