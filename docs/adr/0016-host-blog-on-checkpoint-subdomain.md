# ADR-0016: Host the blog on checkpoint.cescovalle.com with Cloudflare DNS alongside Vercel

## Status

Accepted

## Date

2026-08-03

## Context

The site needs a public hostname. The owner already holds `cescovalle.com`,
registered at GoDaddy and currently serving a developer-brand site from Vercel.

Registering a separate domain for the blog costs roughly USD 15–30 per year in
renewal and starts with no accumulated ranking signal. A subdomain costs nothing.
The concern with a subdomain was topical conflict: the parent domain represents
a software developer, while this site is games criticism.

There is no penalty for topical diversity. What exists is topical authority — a
site consistently covering a subject accumulates standing in it. Google also
evaluates subdomains semi-independently from their parent, so a subdomain does
not meaningfully transfer the parent's standing in either direction. With zero
posts published there is no authority to transfer or dilute in the first place.

The deployment constraint is that Workers Custom Domains require the zone to be
active in the Cloudflare account with Cloudflare as authoritative nameservers.

## Decision

Serve the blog from `checkpoint.cescovalle.com`.

`checkpoint` reads identically in Spanish and English, which matters for a site
whose routes are `/es/` and `/en/`. As a term it carries an editorial sense — a
place to stop and take stock — that fits analysis and opinion better than a
generic gaming word.

Keep GoDaddy as registrar and move the `cescovalle.com` nameservers to
Cloudflare. Delegating only the subdomain while leaving the zone at GoDaddy
(partial or CNAME setup) is a Business-plan feature, so a full nameserver move is
required.

Vercel keeps serving the parent domain. Its records are recreated in Cloudflare
as **DNS only** (unproxied), so Vercel continues to terminate its own TLS and the
existing site is unchanged. Workers Custom Domains creates the proxied record for
`checkpoint`.

Migration procedure:

1. Export the complete GoDaddy zone before changing anything.
2. Recreate every record in Cloudflare, verifying against the export one by one.
   Cloudflare's automatic scan is incomplete and silently misses records.
3. Pay particular attention to `MX`, SPF/DKIM, and domain-verification `TXT`
   records. Losing an `MX` takes email down; losing a verification `TXT` breaks
   Vercel's domain ownership check.
4. Confirm the Vercel records resolve correctly from Cloudflare while still on
   GoDaddy nameservers.
5. Only then switch the nameservers at GoDaddy.

Rollback is reverting the nameservers to GoDaddy.

Free-plan constraints that shape the rest of the architecture, verified against
Cloudflare documentation on 2026-08-03:

| Service                   | Free-plan limit                                                                               | Effect                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Workers                   | 100,000 requests/day; **10 ms CPU per request**                                               | Drives caching, precomputed derived fields, and local image generation |
| D1                        | **500 MB per database**; 5 GB per account; 10 databases; **50 queries per Worker invocation** | Ample storage; the query ceiling constrains page composition           |
| R2                        | 10 GB-month; 1M Class A ops; 10M Class B ops; egress free                                     | Covers Open Graph cards and editorial media (ADR-0015)                 |
| Cloudflare Access         | Up to 50 users                                                                                | Confirms ADR-0003 costs nothing                                        |
| Web Analytics             | Free                                                                                          | Confirms ADR-0018                                                      |
| Crawler Hints / IndexNow  | All plans                                                                                     | Confirms ADR-0014                                                      |
| Cache purge (all methods) | All plans since 2025-04-01; Free is rate-limited to 5 requests/minute                         | Enables the cache-tag model of ADR-0011                                |

Two constraints deserve emphasis because they shape application code rather than
just budget:

- Time spent awaiting D1 does **not** count against the Workers CPU budget;
  rendering does. The 10 ms ceiling is a rendering budget, not a latency budget.
- D1 allows **50 queries per Worker invocation**. A listing page that queries per
  post rather than joining will hit this ceiling, so N+1 access patterns are
  ruled out by the platform, not merely discouraged.

R2 has no charge at this volume, but enabling it requires completing a checkout
flow to add an R2 subscription to the account, so billing details are part of
setup even though the free tier covers the usage.

## Consequences

### Positive

- No recurring hosting or domain cost beyond the existing registration.
- The developer brand is not diluted, since Google treats the subdomain
  semi-independently.
- Named, identifiable authorship supports E-E-A-T; a developer writing technical
  games criticism is a coherent position rather than a topical conflict.
- Moving to a dedicated domain later is inexpensive, because the `301` and slug
  history machinery from ADR-0010 already exists.

### Negative

- The nameserver move touches the DNS of a live professional site, with email
  outage as the failure mode if a record is missed.
- Cloudflare becomes a dependency for the parent domain's DNS, not just the
  blog's.
- The 10 ms CPU ceiling constrains rendering and makes caching load-bearing
  rather than an optimization.
- Two hosting providers now serve one domain, which future DNS work must account
  for.

## Related Decisions

- [ADR-0001](0001-adopt-cloudflare-runtime.md)
- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0011](0011-invalidate-cloudflare-cache-by-cache-tag.md)
- [ADR-0015](0015-separate-social-card-from-editorial-cover-image.md)
- [ADR-0018](0018-adopt-privacy-first-analytics-and-defer-monetization.md)
