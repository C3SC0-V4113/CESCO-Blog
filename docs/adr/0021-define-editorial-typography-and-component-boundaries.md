# ADR-0021: Define editorial typography and component ownership boundaries

## Status

Accepted

## Date

2026-08-03

## Context

Two gaps in the current styling setup both come down to the same question: where
does style live and who owns it.

`src/styles/global.css` defines `--font-heading: 'Merriweather Variable', serif`
inside its `@theme inline` block, and `@fontsource-variable/merriweather` is
imported and installed. **No selector consumes it.** The only font rule is
`html { @apply font-sans }`, so the entire site renders in Figtree and the second
typeface is downloaded for nothing.

Separately, `src/components/` has no structure. It holds `home-hero.tsx` — a
product component — directly beside `ui/`, which is the registry directory. With
three registries incoming (ADR-0020) and two component formats (ADR-0019), an
undefined layout will mix registry primitives with product code, and the next
`shadcn add` will overwrite something it should not.

## Decision

### Typography

Merriweather (`--font-heading`) applies to `h1`–`h3` and to post card titles.
Figtree (`--font-sans`) applies to body copy, UI, and navigation.

The serif/sans pairing gives the home page and listings the authority of a
publication without harming interface legibility. Merriweather is a heavy serif
and is not used for long body copy on screen, where Figtree reads better at
paragraph length.

This requires a rule in the `@layer base` block of `src/styles/global.css`; the
token exists but is currently inert.

### Component ownership

| Ownership                                  | Destination                 |
| ------------------------------------------ | --------------------------- |
| Registry primitive (shadcn, Coss UI, ReUI) | `src/components/ui/`        |
| Reusable product component                 | `src/components/common/`    |
| Feature-specific component                 | `src/components/<feature>/` |
| Route composition                          | `src/pages/`                |
| Theme token                                | `src/styles/global.css`     |

Dependencies flow one way: **feature → common → ui**. The `ui/` directory never
imports from `common/` or from a feature folder.

Nothing product-owned enters `ui/`. To add product behavior to a primitive, wrap
it from `common/` rather than editing the primitive — an edited primitive is
silently reverted by the next registry update.

No component hardcodes a color. All color comes from the semantic tokens already
defined in `:root` and `.dark`, so both themes stay correct without per-component
work.

### Recorded debt

`src/components/home-hero.tsx` is a product component sitting at the root of
`components/`, and `tests/unit/home.test.tsx` imports it from that path. When
implementation begins it moves to `common/` or is replaced by the real home page,
and the test import is updated with it.

## Consequences

### Positive

- The second typeface finally earns the bytes it already costs.
- `shadcn add` can never overwrite product code, because product code is never in
  its target directory.
- The one-way dependency rule makes the boundary checkable rather than a matter
  of taste.
- Token-only color means dark mode needs no per-component work.

### Negative

- Deciding ownership is a required step before writing any component.
- Wrapping instead of editing primitives adds a file whenever a primitive needs
  product behavior.
- Loading two typefaces costs more than one; the serif is justified by editorial
  identity, not by performance.
- The `home-hero.tsx` debt stays open until the home page is implemented.

## Related Decisions

- [ADR-0019](0019-render-astro-first-with-react-islands-for-behavior.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0022](0022-adopt-css-only-motion-with-shared-easing-scale.md)
