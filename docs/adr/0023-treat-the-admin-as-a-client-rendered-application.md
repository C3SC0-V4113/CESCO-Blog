# ADR-0023: Treat the admin as a client-rendered application

## Status

Accepted

## Date

2026-08-03

## Context

ADR-0019 states that a component is `.astro` unless it needs client-side
JavaScript, and does not limit that rule to public pages. Read literally it
applies everywhere, which would require building a rich text editor out of Astro
templates.

That reading is wrong, but the ADR does not say so. The admin inverts every
premise the rule was written under:

| ADR-0019 premise                         | In the admin                                 |
| ---------------------------------------- | -------------------------------------------- |
| Anonymous readers on variable networks   | One authenticated user in a long session     |
| The HTML must be indexable               | Never indexed; sits behind Cloudflare Access |
| ~10 ms CPU budget per request (ADR-0016) | Negligible traffic; one person's volume      |
| Shipping zero JavaScript is the goal     | Interaction **is** the product               |

Nothing about a rich editing surface benefits from being rendered as static
markup, and the reader never pays for it.

## Decision

Routes under `/admin` are **client-rendered React applications**.

Astro still owns the shell: routing, the Cloudflare Access boundary, and the page
layout. The admin content mounts as an island with `client:load`. Admin
components live in `src/components/admin/` and are `.tsx`.

ADR-0019 is hereby scoped to **public surfaces**. Its four-row rendering model,
its island justification requirement, and its performance budget apply to
everything a reader can reach, and to nothing under `/admin`.

**The admin bundle must never reach a public page.** Astro splits by route, but a
careless shared import — a utility, a type, a component pulled from `common/` —
can drag the editor into the public bundle. The permitted dependency direction is
`admin → common → ui`, never the reverse. `common/` must not import from
`admin/`.

ADR-0020 still applies here. No Radix in the admin either. That rule survives
intact because ADR-0024 selects a headless editor with no UI primitives, so no
exception is needed. Had the editor choice required Radix, this would have been
the place to argue for a carve-out; it did not.

## Consequences

### Positive

- The editor can be built with the tools editors are actually built with.
- The public performance rules stay strict precisely because they no longer have
  to accommodate an editing surface.
- Admin work does not compete for the reader-facing CPU budget.
- The scope of ADR-0019 becomes explicit rather than inferred.

### Negative

- Two rendering models coexist in one repository, and the boundary between them
  is a convention rather than a compiler error.
- A shared import can silently leak admin weight into a public page; nothing
  detects this today, so it needs a bundle check at implementation time.
- Components needed on both sides may be duplicated rather than shared, to avoid
  that leak.
- The admin has no progressive enhancement story: without JavaScript it does not
  work at all.

## Related Decisions

- [ADR-0003](0003-protect-admin-with-cloudflare-access.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
- [ADR-0019](0019-render-astro-first-with-react-islands-for-behavior.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0024](0024-adopt-tiptap-for-the-editorial-content-pipeline.md)
