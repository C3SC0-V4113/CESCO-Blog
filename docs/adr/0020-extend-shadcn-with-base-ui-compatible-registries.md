# ADR-0020: Extend shadcn with Base UI–compatible registries

## Status

Accepted

## Date

2026-08-03

## Context

`components.json` declares `style: "base-nova"` and `registries: {}`. The single
installed primitive, `src/components/ui/button.tsx`, imports from
`@base-ui/react/button`. There is no `@radix-ui/*` package anywhere in
`package.json`.

This matters more than it appears. Most community shadcn registries are built on
Radix, because classic shadcn/ui is. Installing a Radix-based component into this
project would add a second primitive library: two implementations of focus
management, keyboard interaction, and ARIA semantics running side by side, and
both shipped to the reader.

The `@shadcn` registry alone does not cover everything an editorial site needs,
so the question is which additional registries can be adopted without creating
that split.

## Decision

Add **Coss UI** and **ReUI** to `registries` in `components.json`.

Compatibility assessment, verified against each project's documentation on
2026-08-03:

| Registry                                    | Primitives                                                                    | Verdict                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| [Coss UI](https://coss.com/ui)              | Built **on Base UI**                                                          | Shares primitives with `@base-ui/react`. Adopted. |
| [ReUI](https://reui.io)                     | Primitive-agnostic: publishes a Base UI **and** a Radix variant of each entry | Adopted, **Base UI variant only**                 |
| [chanhdai](https://chanhdai.com) (`@ncdai`) | Decorative effects, not primitives                                            | **Rejected for now**                              |

The governing rule: **no component that pulls in `@radix-ui/*` enters this
project.** Before installing anything from ReUI, confirm the entry being added is
the Base UI variant. This is a manual check with no automated guard, so it
belongs in review.

`chanhdai` is rejected because its dependencies could not be confirmed and its
catalogue is largely motion-driven effects, which would conflict with ADR-0022.
Two of its entries — TOC Minimap and Theme Toggle Effect — are directly useful
here, so the rejection is provisional. Reconsidering it requires confirming that
the specific entry declares no `motion` or `framer-motion` dependency and ships
no Radix primitive.

Registry URLs are taken from each project's own installation documentation at the
time they are added, not guessed.

## Consequences

### Positive

- One primitive system, so focus, keyboard, and ARIA behavior stay consistent
  across every component.
- Coss UI covers the primitives this site needs — card, badge, separator, avatar,
  breadcrumb, pagination, tooltip, menu, dialog, drawer, tabs, skeleton — without
  writing them.
- ReUI adds richer compositions when the core registry falls short.
- The rejection of `chanhdai` is recorded with the conditions that would reverse
  it, rather than being forgotten.

### Negative

- ReUI's dual-variant model means every installation is a decision point where
  the wrong choice silently introduces Radix.
- Three registries mean three upstream projects whose conventions can drift from
  each other.
- Nothing in the toolchain enforces the no-Radix rule; it depends on review.
- Components from different registries may style the same token differently and
  need reconciling against `DESIGN.md`.

## Related Decisions

- [ADR-0019](0019-render-astro-first-with-react-islands-for-behavior.md)
- [ADR-0021](0021-define-editorial-typography-and-component-boundaries.md)
- [ADR-0022](0022-adopt-css-only-motion-with-shared-easing-scale.md)
