/**
 * Which side of the admin boundary a request falls on (ADR-0039).
 *
 * Pure so every bypass shape is a jsdom row rather than a deployed request. The
 * middleware owns the consequences; this module only decides.
 */

export type ActionCall = { calledFrom: 'form' | 'rpc'; name: string };
export type AdminRequest = {
  routePattern: string;
  pathname: string;
  action: ActionCall | undefined;
};
export type AdminBoundary = 'public' | 'admin' | 'reject';

/**
 * The action Astro will actually run. Its resolver splits on `.` and decodes
 * each segment, so `%61dmin.createPost` executes `admin.createPost`; comparing
 * raw names against a prefix is what let that shape through.
 */
export function canonicalActionName(raw: string): string | null {
  try {
    return raw
      .split('.')
      .map((segment) => decodeURIComponent(segment))
      .join('.');
  } catch {
    return null;
  }
}

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');

export function classifyAdminRequest({
  routePattern,
  pathname,
  action,
}: AdminRequest): AdminBoundary {
  if (action) {
    const name = canonicalActionName(action.name);
    if (name === null) return 'reject';
    if (name.split('.')[0] === 'admin') {
      // Form calls run on whatever public page receives them, outside Access.
      if (action.calledFrom === 'form') return 'reject';
      // Astro takes the name after the *last* `/_actions/`, so only the one
      // path Access is configured to cover may carry an admin action.
      return pathname === `/_actions/${name}` ? 'admin' : 'reject';
    }
  }
  // Routing decodes the pathname before matching, so `/%61dmin/posts` renders
  // the admin page; the matched pattern is what reflects that.
  return isAdminPath(routePattern) || isAdminPath(pathname) ? 'admin' : 'public';
}
