# ADR-0030: Style components with Tailwind utilities

## Status

Accepted

## Date

2026-08-05

## Context

The project carries two viable styling systems. Tailwind 4 is installed, its
`@theme` block in `src/styles/global.css` publishes every semantic token, and
`class-variance-authority` already drives `src/components/ui/button.tsx`
(ADR-0020). Astro also supports component-scoped `<style>` blocks, and the first
`.astro` components written — `Prose`, `ArticleDetail`, `ErrorState` — used those.

Nothing had decided between them, so the choice was being made per component by
whoever wrote it first. Two systems styling the same page is how a codebase ends
up with a colour defined in three places.

One popular reason for preferring one or the other does not apply here. Astro's
`<style>` blocks are **not** inline styles: they are extracted into a stylesheet
at build time and scoped through a generated `data-astro-cid-*` attribute. The
built output contains no `style="…"` attributes at all, so there is no injection
surface either way. This decision is about maintainability, not security.

ADR-0021 already requires that no component hardcode a colour, and that every
colour come from the semantic tokens.

## Decision

Style components with **Tailwind utility classes** by default.

The deciding argument is ADR-0021's token rule. A utility class _is_ the token —
`text-foreground`, `bg-muted`, `rounded-md` cannot drift from the theme because
they are generated from it. A scoped stylesheet only honours the rule as long as
every author remembers to write `var(--foreground)` instead of a hex value, and
nothing catches them when they do not. One system, and the constraint enforced by
construction rather than by review.

Where a component needs variants, express them with `cva` and import the variant
function, including from `.astro` files (ADR-0019).

### The one exception

Component-scoped `<style>` is correct for styling **slotted content the component
does not own** — descendants it never writes markup for.

`Prose` is the case. It wraps rendered article HTML and has to set a typographic
scale across `h2`, `h3`, `p`, `pre` and `code` it never authored. In utilities
that becomes a chain of arbitrary variants — `[&_h2]:font-heading
[&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:mt-10 …` repeated per element — which
is unreadable at the size a real type scale needs, and which no longer resembles
the CSS it compiles to.

The exception is narrow on purpose: styling descendants you did not write. It
does not extend to a component's own markup, where the utilities are legible.

Any scoped block must still read every value from a token, since ADR-0021 applies
regardless of which system expresses it.

## Consequences

### Positive

- The no-hardcoded-colour rule holds by construction rather than by discipline.
- One styling system across `ui/`, `common/` and feature components, which is
  also the system `cva` and the registry primitives already speak.
- Component markup shows its own styling, without a reader scrolling to a
  `<style>` block at the bottom of the file to find out what a class does.
- Theme changes propagate from `@theme` without touching components.

### Negative

- Utility classes make markup denser, and a long class list is harder to scan
  than a named rule.
- The exception is a judgement call. "Slotted content the component does not
  own" is a clear line, but the first ambiguous case will need a ruling rather
  than a lookup.
- Converting the existing scoped components is churn that changes no behaviour.

## Related Decisions

- [ADR-0019](0019-render-astro-first-and-reserve-react-islands.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0021](0021-define-editorial-typography-and-component-boundaries.md)
