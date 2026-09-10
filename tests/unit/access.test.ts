// @vitest-environment node
// jsdom's Uint8Array comes from another realm, and jose rejects it as key
// material; this module has no DOM to need jsdom for.
import { createLocalJWKSet, exportJWK, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { accessPolicy, verifyAccessJwt } from '@/lib/access';

const teamDomain = 'checkpoint.cloudflareaccess.com';
const audience = 'access-application-aud';
const expected = { teamDomain, audience };
const kid = 'access-signing-key';

async function rsaKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
}

const trusted = await rsaKeyPair();
const untrusted = await rsaKeyPair();
const accessKeys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(trusted.publicKey)), kid, alg: 'RS256' }],
});
const now = () => Math.floor(Date.now() / 1000);

function accessToken(claims: { iss?: string; aud?: string; exp?: number } = {}) {
  return new SignJWT({ email: 'editor@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(claims.iss ?? `https://${teamDomain}`)
    .setAudience(claims.aud ?? audience)
    .setIssuedAt(now() - 120)
    .setExpirationTime(claims.exp ?? now() + 300);
}

describe('accessPolicy', () => {
  it.each([
    { mode: 'local', hostname: '127.0.0.1', teamDomain: '', audience: '', policy: 'local' },
    { mode: 'local', hostname: 'localhost', teamDomain: '', audience: '', policy: 'local' },
    { mode: 'local', hostname: '[::1]', teamDomain: '', audience: '', policy: 'local' },
    {
      mode: 'local',
      hostname: 'checkpoint.cescovalle.com',
      teamDomain,
      audience,
      policy: 'misconfigured',
    },
    {
      mode: 'cloudflare',
      hostname: 'checkpoint.cescovalle.com',
      teamDomain,
      audience,
      policy: 'verify',
    },
    { mode: 'cloudflare', hostname: 'localhost', teamDomain, audience, policy: 'verify' },
    {
      mode: 'cloudflare',
      hostname: 'checkpoint.cescovalle.com',
      teamDomain,
      audience: '',
      policy: 'misconfigured',
    },
    {
      mode: 'cloudflare',
      hostname: 'checkpoint.cescovalle.com',
      teamDomain: '',
      audience,
      policy: 'misconfigured',
    },
    { mode: '', hostname: 'localhost', teamDomain, audience, policy: 'misconfigured' },
    { mode: 'Cloudflare', hostname: 'localhost', teamDomain, audience, policy: 'misconfigured' },
  ])('resolves $mode on $hostname to $policy', ({ policy, ...config }) => {
    expect(accessPolicy(config)).toBe(policy);
  });
});

describe('verifyAccessJwt', () => {
  it('accepts a token signed by the team key for this application', async () => {
    const token = await accessToken().sign(trusted.privateKey);
    await expect(verifyAccessJwt(token, accessKeys, expected)).resolves.toBe(true);
  });

  it.each([
    ['another application', () => accessToken({ aud: 'other-aud' }).sign(trusted.privateKey)],
    [
      'another team',
      () => accessToken({ iss: 'https://other.cloudflareaccess.com' }).sign(trusted.privateKey),
    ],
    ['an expired session', () => accessToken({ exp: now() - 60 }).sign(trusted.privateKey)],
    ['an untrusted signer', () => accessToken().sign(untrusted.privateKey)],
    [
      'a symmetric algorithm',
      () =>
        new SignJWT({})
          .setProtectedHeader({ alg: 'HS256', kid })
          .setIssuer(`https://${teamDomain}`)
          .setAudience(audience)
          .setExpirationTime(now() + 300)
          .sign(new TextEncoder().encode('a-shared-secret-an-attacker-picked')),
    ],
    ['a malformed token', async () => 'not-a-jwt'],
  ])('rejects a token from %s', async (_scenario, token) => {
    await expect(verifyAccessJwt(await token(), accessKeys, expected)).resolves.toBe(false);
  });
});
