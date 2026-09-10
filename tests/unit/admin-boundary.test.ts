import { describe, expect, it } from 'vitest';

import { canonicalActionName, classifyAdminRequest } from '@/lib/admin-boundary';

const rpcRoute = '/_actions/[...path]';
const form = (name: string) => ({ calledFrom: 'form' as const, name });
const rpc = (name: string) => ({ calledFrom: 'rpc' as const, name });

describe('canonicalActionName', () => {
  it('decodes each segment the way Astro resolves the action', () => {
    expect(canonicalActionName('%61dmin.create%50ost')).toBe('admin.createPost');
    expect(canonicalActionName('admin.createPost')).toBe('admin.createPost');
  });

  it('refuses names Astro could not decode either', () => {
    expect(canonicalActionName('%E0%A4%A')).toBeNull();
  });
});

describe('classifyAdminRequest', () => {
  it.each([
    {
      scenario: 'a form call to an admin action',
      request: { routePattern: '/es', pathname: '/es/', action: form('admin.createPost') },
      expected: 'reject',
    },
    {
      scenario: 'a form call with a percent-encoded admin name',
      request: { routePattern: '/es', pathname: '/es/', action: form('%61dmin.createPost') },
      expected: 'reject',
    },
    {
      scenario: 'a form call even on the canonical admin action path',
      request: {
        routePattern: '/admin',
        pathname: '/_actions/admin.createPost',
        action: form('admin.createPost'),
      },
      expected: 'reject',
    },
    {
      scenario: 'an RPC call behind a nested /_actions/ prefix',
      request: {
        routePattern: rpcRoute,
        pathname: '/_actions/x/_actions/admin.createPost',
        action: rpc('admin.createPost'),
      },
      expected: 'reject',
    },
    {
      scenario: 'an RPC call with a percent-encoded admin name',
      request: {
        routePattern: rpcRoute,
        pathname: '/_actions/%61dmin.createPost',
        action: rpc('%61dmin.createPost'),
      },
      expected: 'reject',
    },
    {
      scenario: 'an action name with malformed percent-encoding',
      request: { routePattern: rpcRoute, pathname: '/_actions/%E0%A4%A', action: rpc('%E0%A4%A') },
      expected: 'reject',
    },
    {
      scenario: 'an RPC call on the canonical admin path',
      request: {
        routePattern: rpcRoute,
        pathname: '/_actions/admin.createPost',
        action: rpc('admin.createPost'),
      },
      expected: 'admin',
    },
    {
      scenario: 'the admin dashboard',
      request: { routePattern: '/admin', pathname: '/admin', action: undefined },
      expected: 'admin',
    },
    {
      scenario: 'an admin page',
      request: {
        routePattern: '/admin/posts/new',
        pathname: '/admin/posts/new',
        action: undefined,
      },
      expected: 'admin',
    },
    {
      scenario: 'an admin page reached through a percent-encoded path',
      request: { routePattern: '/admin/posts', pathname: '/%61dmin/posts', action: undefined },
      expected: 'admin',
    },
    {
      scenario: 'a public page',
      request: { routePattern: '/es', pathname: '/es/', action: undefined },
      expected: 'public',
    },
    {
      scenario: 'a public page whose name only starts like the admin',
      request: { routePattern: '/es/[slug]', pathname: '/es/administracion', action: undefined },
      expected: 'public',
    },
    {
      scenario: 'a public RPC action',
      request: {
        routePattern: rpcRoute,
        pathname: '/_actions/newsletter.subscribe',
        action: rpc('newsletter.subscribe'),
      },
      expected: 'public',
    },
    {
      scenario: 'a public form action',
      request: { routePattern: '/es', pathname: '/es/', action: form('newsletter.subscribe') },
      expected: 'public',
    },
  ] as const)('classifies $scenario as $expected', ({ request, expected }) => {
    expect(classifyAdminRequest(request)).toBe(expected);
  });
});
