import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('admin route boundary', () => {
  it('hydrates the admin application without replacing Astro-owned HTML', () => {
    const route = readFileSync(join(root, 'src/pages/admin/index.astro'), 'utf8');
    const middleware = readFileSync(join(root, 'src/middleware.ts'), 'utf8');

    expect(route).toContain('<AdminApp client:load />');
    expect(route).not.toContain('client:only');
    expect(middleware).toContain("context.url.pathname === '/admin'");
    expect(middleware).toContain("context.url.pathname.startsWith('/admin/')");
    expect(middleware).not.toMatch(/from ['"].*(auth|session)|cookies?\./i);
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
