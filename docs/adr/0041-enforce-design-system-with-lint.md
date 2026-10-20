# ADR-0041: Enforce design-system conventions with lint

**Status:** Accepted — 2026-10-19

## Context

The design system uses Tailwind theme tokens and shadcn components built on Base
UI ([ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)).
Without automated checks, classes drift toward duplicate, deprecated, arbitrary,
or conflicting values. The `no-restyle` rule also treated every one-off visual
class on a kit component as a violation, encouraging single-use variants and
native-element workarounds. The files under `src/components/ui/` are our kit,
not untouchable vendor files; linting them would make upstream
`shadcn add --diff` report project-side changes as registry drift.

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
ignored so `shadcn add --diff` can compare generated files with upstream. The
`no-restyle` rule is off: its blanket ban on visual classes caused callers to
encode one-off styling as single-use variants or replace kit controls with
native elements. Use `cva` only inside `src/components/ui/` for shared patterns;
product components pass one-off classes through `className`. The kit is ours to
modify when a style is a project-wide pattern.

Arbitrary values should be replaced by theme tokens or named utilities. The
small allow list is reserved for browser-specific layout values that do not
belong on the theme scale:

- `md:min-h-[calc(100dvh-4rem)]` and
  `max-h-[calc(100dvh-2rem)]` keep panels within the visible viewport.
- `pb-[env(safe-area-inset-bottom)]` respects device safe areas.
- `mt-[-52.35%]` aligns the social-card text overlay to its 1.91:1 image.

Repeated administration dimensions use named theme values. Transition property
lists use Tailwind's arbitrary `transition-[...]` utility; this form is
explicitly allowed because its property list is a CSS declaration rather than a
design token. Typeset stays upstream in
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
- Shared component variants stay in the UI kit; one-off visual adjustments remain
  at the product call site.
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
