# ADR-0019: Render Astro-first and reserve React islands for behavior

## Status

Accepted

## Date

2026-08-03

## Context

The project is committed to shadcn for its design system, and every shadcn
component is a React component. The question is what that costs in Astro.

It is **not** true that a React component in Astro implies shipped JavaScript. A
framework component without a `client:*` directive is rendered to HTML on the
server and ships nothing to the browser. Only a hydration directive creates an
island. So the trade-off is not "React versus no JavaScript" — it is four
distinct options with different costs:

| Approach                                       | Client JS         | Server CPU                                                                |
| ---------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `.astro` component                             | none              | **Lowest** — compiles to a template that concatenates strings             |
| `.tsx` without `client:*`                      | none              | **Higher** — `react-dom/server` builds the element tree and serializes it |
| `.tsx` with `client:load` / `idle` / `visible` | React + component | **The same server render**, plus hydration on the client                  |
| `.tsx` with `client:only`                      | React + component | **None** — server rendering is skipped                                    |

The third row is the counter-intuitive one: a hydrated island is server-rendered
**as well as** shipped, not instead of. That is deliberate. React's
`hydrateRoot()` does not build the DOM — it attaches to existing markup and wires
up event listeners, so server HTML matching what React would produce has to be
there. It also means the component is visible before its JavaScript arrives,
which matters most under `client:visible`, where hydration may be delayed
indefinitely or never happen at all.

`client:only` is the only directive that avoids the server cost, and Astro's
documentation is explicit that it "skips HTML server rendering, and renders only
on the client". It buys that saving by giving up everything the server render
provides: empty markup until the bundle executes, layout shift when it does, and
nothing for a crawler that does not run JavaScript. It is an escape hatch, not a
default, and no island in this project uses it.

The second row is where the real constraint lives. ADR-0016 records a ~10 ms CPU
budget per request on the Workers free plan,
against which rendering counts and waiting on D1 does not. Rendering a React tree
through `react-dom/server` is measurably more expensive than emitting a string
from a compiled Astro template. For one or two components the difference is
irrelevant; for a listing page rendering twenty post cards, it is twenty React
trees against a fixed budget.

The magnitude of that difference is **not known and must be measured** before it
is treated as settled — see the note at the end of this decision.

There is also a composition constraint that runs the other way: an `.astro`
component cannot be rendered inside a React island. Anything that must live
within a hydrated component has to be `.tsx`, regardless of preference.

## Decision

**A component is `.astro` unless it has behavior that requires client-side
JavaScript, or unless it must compose inside a React island.**

The reason is CPU on the server, not bytes on the client. Both `.astro` and
un-hydrated `.tsx` ship zero JavaScript; `.astro` is chosen because it is the
cheaper way to produce the same HTML under a constrained budget.

Where a registry primitive is used only for its styling, importing its exported
`cva` variant function avoids the React render entirely:

```astro
---
import { buttonVariants } from '@/components/ui/button';
---

<a href={href} class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
  <slot />
</a>
```

This is also the correct pattern independent of performance: it applies button
styling to an anchor, rather than rendering a `<button>` where a link belongs.
Using `<Button>` without a hydration directive is equally valid and also ships no
JavaScript — it simply costs more to render.

React islands are allowed only for the following, each with its hydration
directive and the reason it needs JavaScript:

| Island           | Directive        | Why it needs JS                                                                      |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `ThemeToggle`    | `client:load`    | Reads and writes `localStorage`; must be interactive immediately                     |
| `MobileNav`      | `client:idle`    | Overlay with focus trapping and keyboard dismissal                                   |
| `TocScrollSpy`   | `client:visible` | `IntersectionObserver` over article headings                                         |
| `CopyLinkButton` | `client:visible` | `navigator.clipboard`                                                                |
| `LocaleSwitcher` | `client:idle`    | Only if it needs open/close state; a plain `<a>` to the alternate URL stays `.astro` |
| `SearchCommand`  | `client:idle`    | Deferred to the search phase                                                         |

Everything else — post cards, article body, byline, tags, static table of
contents, header, footer, analysis metadata panel, disclosure notice, error
pages — is `.astro`.

Adding an island is a decision that must be justified in `DESIGN.md`, not a
default. If a component's only interactivity is navigation, it is a link, not an
island.

Theme flash is handled by a small blocking inline script in `<head>` that applies
the `dark` class before first paint. This is the single justified exception to
"no blocking JavaScript", because the alternative is a visible flash of the wrong
theme on every navigation.

**Pending measurement.** The CPU cost of rendering a component through
`react-dom/server` versus an equivalent compiled Astro template is known to be
higher in direction but not in magnitude. Benchmark a realistic listing surface —
twenty `PostCard` instances — both ways inside the Worker before treating this
preference as load-bearing. If the difference proves negligible at this scale,
the `.astro` default becomes a stylistic convention rather than a performance
requirement, and this ADR should be amended to say so.

## Consequences

### Positive

- Content pages ship no JavaScript, so reading is unaffected by network or CPU
  conditions on the client.
- Repeated surfaces render through the cheapest available path, which matters
  most exactly where components repeat: listings.
- The design system stays shadcn-first: the same variants, tokens, and class
  strings drive both static and interactive components.
- Islands are few enough to reason about individually.

### Negative

- Two component formats coexist, and contributors must classify correctly before
  writing.
- The justification rests on a CPU difference whose size has not been measured,
  so the rule may be stricter than the evidence warrants.
- Anything that must compose inside a hydrated island cannot be `.astro`, so some
  components will be `.tsx` for structural reasons rather than by preference.
- A component needed both standalone and inside an island may end up duplicated
  across formats.
- Importing a variant function from a `.tsx` file into `.astro` is a pattern that
  looks wrong until it is explained, so it needs documenting where people will
  find it.
- The theme script is blocking, which is a deliberate and permanent exception.

## Related Decisions

- [ADR-0001](0001-adopt-cloudflare-runtime.md)
- [ADR-0016](0016-host-blog-on-checkpoint-subdomain.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0021](0021-define-editorial-typography-and-component-boundaries.md)
- [ADR-0022](0022-adopt-css-only-motion-with-shared-easing-scale.md)
