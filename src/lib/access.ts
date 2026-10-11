import { jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Cloudflare Access identity, checked inside the Worker (ADR-0039).
 *
 * Pure given its inputs: the signing keys arrive as a resolver, so tests pass a
 * local key set and the middleware passes the team's remote one.
 */

export type AccessPolicy = 'local' | 'verify' | 'misconfigured';
export type AccessApplication = { teamDomain: string; audience: string };
export type AccessConfig = AccessApplication & { mode: string; hostname: string };

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Local mode skips identity entirely, so it is honoured only where nobody but
 * the developer can connect. Anything short of a complete Cloudflare setup is
 * misconfigured rather than open.
 */
export function accessPolicy({ mode, hostname, teamDomain, audience }: AccessConfig): AccessPolicy {
  if (mode === 'local') return loopbackHosts.has(hostname) ? 'local' : 'misconfigured';
  return mode === 'cloudflare' && teamDomain && audience ? 'verify' : 'misconfigured';
}

export async function verifyAccessJwt(
  token: string,
  getKey: JWTVerifyGetKey,
  { teamDomain, audience }: AccessApplication
): Promise<boolean> {
  try {
    await jwtVerify(token, getKey, {
      issuer: `https://${teamDomain}`,
      audience,
      // Pinned so a token cannot pick a weaker algorithm than the team signs with.
      algorithms: ['RS256'],
    });
    return true;
  } catch {
    return false;
  }
}
