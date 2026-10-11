# ADR-0039: Verify Cloudflare Access identity in the Worker

**Status:** Accepted — 2026-09-10

## Context

ADR-0034 relied on an Access path rule and a middleware check on raw action
names. Astro resolves actions differently from both. `getAction`
(`astro/dist/actions/load.js`) decodes each dot-separated segment, so
`POST /es/?_action=%2561dmin.createPost` passed the raw-name check and ran
`admin.createPost` on a public page. `getCallerInfo`
(`astro/dist/actions/runtime/server.js`) takes the name after the last
`/_actions/`, so `POST /_actions/x/_actions/admin.createPost` ran it outside
`/_actions/admin.*`. Nothing in the Worker stood behind the path rule.

## Decision

Middleware classifies every request in `src/lib/admin-boundary.ts` by canonical
action name and matched route pattern. Admin form calls, admin RPC off the exact
`/_actions/<canonical name>` path, and undecodable names get 403. Admin pages and
admin RPC then need a `Cf-Access-Jwt-Assertion` that `jose` verifies against the
team's certs: RS256 only, issuer `https://<ACCESS_TEAM_DOMAIN>`, audience
`ACCESS_AUD`. `ACCESS_MODE=local` skips verification on loopback hosts only; any
other incomplete configuration answers 503.

**Alternatives rejected:** The path rule alone, because parity between Access's
matcher and Astro's parser cannot be proven and already failed twice. Custom
authentication contradicts ADR-0003; Access still signs users in, and the Worker
only checks its signature.

**Consequences:** Production must set `ACCESS_MODE=cloudflare`,
`ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, or every admin request answers 503. Signing
keys are fetched once per isolate and cached by `jose`. The Access application
should still cover `/admin`, `/admin/*`, and `/_actions/admin.*`, so sign-in
happens at the edge.

**Related:** [ADR-0003](0003-protect-admin-with-cloudflare-access.md), [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md), and [ADR-0034](0034-protect-admin-actions-with-cloudflare-access.md).
