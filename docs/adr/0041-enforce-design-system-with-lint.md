# ADR-0041: Enforce design-system conventions with lint

**Status:** Accepted — 2026-10-19

## Context

The design system uses Tailwind theme tokens and shadcn components built on Base
UI ([ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)).
Without automated checks, classes drift toward duplicate, deprecated, arbitrary,
or conflicting values, and callers can restyle shared component primitives with
one-off visual classes. The registry components themselves are vendored shadcn
code; linting them would make upstream `shadcn add --diff` report project-side
changes as registry drift.

The editor also emits deliberate values that cannot use a theme scale: viewport
bounds, safe-area insets, and the overlap ratio that places the OG text overlay.
The Typeset stylesheet is an upstream-owned stylesheet, while the prose wrapper
keeps local overrides for this site's design. Its generated editor output
currently includes many arbitrary classes, so those overrides should remain
local rather than forking Typeset's file.

The shadcn CLI used for the Badge generated `import { cn } from "cn"` and added
an unrelated `cn` npm dependency. That import is not the project's helper and
must not be accepted in generated components.

## Decision

Use `eslint-plugin-better-tailwindcss` to enforce canonical and shorthand
classes, conflicting/deprecated/duplicate class detection, and the restriction
that accent text uses `text-brand` rather than the fill token `text-primary`.
Use `@shadcn/lint` to enforce component ownership, semantic colors, arbitrary
value policy, no inline styles, known classes, and statically analyzable class
strings. All configured rules run at error severity.

The shadcn rules apply to `.tsx` files. `src/components/ui/**` remains globally
ignored because it is the vendored registry kit; product components should use
its variants rather than editing kit styles to satisfy a call site. The
`no-restyle` allow list is limited to parent placement and layout: margins,
full/auto/content widths, child flex/grid placement, order, and display toggles.
It does not allow gaps, padding, colors, typography, control sizes, borders,
rings, or other visual styling on a shared component.

Arbitrary values should be replaced by theme tokens or named utilities. The
small allow list is reserved for browser-specific layout values that do not
belong on the theme scale:

- `md:min-h-[calc(100dvh-4rem)]` and
  `max-h-[calc(100dvh-2rem)]` keep panels within the visible viewport.
- `pb-[env(safe-area-inset-bottom)]` respects device safe areas.
- `mt-[-52.35%]` aligns the social-card text overlay to its 1.91:1 image.

Repeated administration dimensions and transition property lists use named
theme values or `@utility` classes. Typeset stays upstream in
`src/styles/typeset.css`; site-specific metrics and structures that its controls
do not cover stay in the prose override block. Typeset currently overrides most
editor-produced classes, so the wrapper's overrides preserve the existing article
design while keeping the upstream file updateable.

Every shadcn CLI generated file is checked for imports from `"cn"` or `'cn'` and
must instead import the project's `cn` helper from `@/lib/utils`. Do not add the
unrelated `cn` package.

## Consequences

### Positive

- Tailwind and shadcn violations fail lint before they drift into product UI.
- Shared components own their visual variants, while layout callers retain a
  small, documented set of placement classes.
- Registry files stay comparable with upstream shadcn output.
- Arbitrary values remain exceptional and have an auditable allow list.

### Trade-offs

- Registry updates and generated files require a manual import check because the
  CLI can emit the wrong `cn` package.
- Typeset upgrades require checking the prose override block against upstream
  controls and the article design.
- An intentional new arbitrary value or component variant requires an explicit
  policy or API change.

## Related Decisions

- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0030](0030-style-components-with-tailwind-utilities.md)
