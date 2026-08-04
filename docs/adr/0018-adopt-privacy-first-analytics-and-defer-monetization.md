# ADR-0018: Adopt privacy-first analytics, transparency pages, and defer monetization

## Status

Accepted

## Date

2026-08-03

## Context

The site needs a way to tell whether distribution work is having any effect, and
a set of pages that establish who publishes it and under what standards. Google
Discover eligibility depends in part on accessible About, Contact, and editorial
policy information alongside visible authorship.

Monetization was considered and deliberately postponed. Implementing ads,
affiliates, or sponsorship before there is content, audience, or measurement
adds disclosure obligations and layout constraints in exchange for no revenue.

## Decision

Use Cloudflare Web Analytics as the initial analytics layer: free, cookie-free,
and requiring no consent banner.

Record its blind spots rather than discovering them later. It is a client-side
beacon, so it does not measure RSS consumption, does not see bots or crawlers,
and loses every visitor running a content blocker. For a phase whose stated goal
is measuring distribution, that is a material gap.

Complement it with:

- Google Search Console for impressions, queries, and index coverage.
- Server-side request signals for the RSS and sitemap endpoints, which the beacon
  cannot see by construction.
- IndexNow via Cloudflare Crawler Hints (ADR-0014) for crawl freshness.

Publish transparency pages in both locales:

| Spanish                  | English                |
| ------------------------ | ---------------------- |
| `/es/acerca-de`          | `/en/about`            |
| `/es/contacto`           | `/en/contact`          |
| `/es/privacidad`         | `/en/privacy`          |
| `/es/politica-editorial` | `/en/editorial-policy` |
| `/es/divulgaciones`      | `/en/disclosures`      |

These are reasonable transparency statements written by the site owner, not legal
advice, and the ADR does not claim regulatory compliance.

Defer advertising, affiliate links, and sponsored content. When any of them is
activated, disclosure must be clear and visible on the affected content —
consistent with the review-copy disclosure rule in ADR-0012.

A note for the contact page specification: receiving mail through Cloudflare
Email Routing is free, but **sending is not** — MailChannels ended its free
service for Workers in 2024. Either an external provider with a free tier is
used, or the form writes to D1 and is read from the admin. Turnstile is free if
the form needs bot protection.

## Consequences

### Positive

- Measurement starts at no cost and with no consent banner or cookie disclosure.
- The known gaps are documented, so conclusions drawn from the numbers are
  appropriately hedged.
- Trust pages support Discover eligibility and give readers a real publisher
  identity.
- Deferring monetization keeps the first phase free of disclosure and layout
  obligations.

### Negative

- Traffic figures will understate reality by an unknown margin, and RSS
  readership is invisible until server-side signals exist.
- Three separate surfaces must be consulted to form a complete picture.
- Trust pages are content that must be written and maintained in two languages
  before they provide any value.
- Retrofitting monetization later means revisiting layout and disclosure across
  existing content.

## Related Decisions

- [ADR-0012](0012-extend-editorial-schema-for-authors-series-and-analysis.md)
- [ADR-0014](0014-serve-rss-and-sitemap-as-dynamic-endpoints.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
