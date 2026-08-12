# ADR-0034: Protect admin actions with Cloudflare Access

**Status:** Accepted — 2026-08-12

## Context

ADR-0003 covers `/admin`, while ADR-0031 puts Actions under `/_actions/<name>`.

## Decision

Private actions live under `admin.*`; Access protects `/admin`, `/admin/*`, and
`/_actions/admin.*`. Middleware rejects form calls, leaving only protected RPC.
Live Access enforcement remains external.

**Alternatives rejected:** Custom APIs contradict ADR-0031; Worker identity checks
duplicate ADR-0003; exempting all Actions includes public or unnamespaced mutations.

**Consequence:** Deployment depends on an external path rule the repository cannot prove.

**Related:** [ADR-0003](0003-protect-admin-with-cloudflare-access.md), [ADR-0023](0023-treat-the-admin-as-a-client-rendered-application.md), and [ADR-0031](0031-layer-the-data-path-by-effect-and-testability.md).
