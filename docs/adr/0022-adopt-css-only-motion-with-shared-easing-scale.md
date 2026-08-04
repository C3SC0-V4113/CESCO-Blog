# ADR-0022: Adopt CSS-only motion with a shared easing scale

## Status

Accepted

## Date

2026-08-03

## Context

Motion adds polish, but the usual approach — a JavaScript animation library such
as Motion or Framer Motion — conflicts with ADR-0019. Content pages ship no
JavaScript, so an animation runtime would be the largest client dependency on a
site that otherwise has none.

The project already has what it needs: `tw-animate-css` is installed and imported
in `src/styles/global.css`, and it provides enter/exit animation utilities with
no runtime.

What is missing is not a library but a set of rules. Without agreed easing curves
and durations, animations accumulate inconsistently: each component picks its own
timing, paired elements drift apart, and the interface feels assembled rather than
designed.

## Decision

No JavaScript animation library. All motion is CSS.

Define an easing scale as custom properties in `src/styles/global.css`:

```css
--ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
--ease-in-out-cubic: cubic-bezier(0.645, 0.045, 0.355, 1);
```

Selection rules:

| Situation                              | Easing        | Duration   |
| -------------------------------------- | ------------- | ---------- |
| Element entering or leaving the screen | `ease-out`    | 150–250 ms |
| On-screen element moving or morphing   | `ease-in-out` | 200–300 ms |
| Hover and color changes                | `ease`        | 100–150 ms |
| Constant motion (marquee, ticker)      | `linear`      | —          |

`ease-in` is not used. Its slow start delays visual feedback and makes the
interface feel sluggish.

Invariants:

- Animate only `transform` and `opacity`. Never animate properties that trigger
  layout, such as `width`, `height`, `margin`, or `padding`.
- Nothing exceeds 300 ms.
- Exit animations run roughly 20% faster than their entrance.
- Elements that animate as a unit — overlay and panel, tooltip and arrow — share
  identical easing and duration.
- Enter from `scale(0.95)`, never from `scale(0)`.
- **Every animation carries its own `@media (prefers-reduced-motion: reduce)`
  block** setting `animation: none` or `transition: none`. No exceptions, not
  even for opacity.
- Hover effects are wrapped in `@media (hover: hover) and (pointer: fine)` so a
  tap on a touch device does not trigger a stuck hover state.
- Do not animate what a reader sees hundreds of times: primary navigation, links
  inside article body copy, and other high-frequency controls stay instant.

Page transitions use **native CSS View Transitions**
(`@view-transition { navigation: auto; }`), not Astro's `<ClientRouter />`. The
CSS form is cross-document, requires no JavaScript, and degrades to ordinary
navigation where unsupported. `<ClientRouter />` would introduce a client runtime
and contradict ADR-0019.

The existing button already applies `active:not-aria-[haspopup]:translate-y-px`.
That press feedback is adopted as the project pattern rather than replaced.

## Consequences

### Positive

- Motion costs no JavaScript, keeping content pages at zero client bundle.
- A shared easing scale makes independently written components feel like one
  system.
- Reduced-motion support is a stated requirement rather than an afterthought.
- Restricting animation to `transform` and `opacity` keeps work on the compositor
  and off the main thread.

### Negative

- CSS animations cannot be interrupted mid-flight while preserving velocity, so
  gesture-driven and drag interactions are effectively out of scope.
- Spring physics is unavailable; motion will feel more mechanical than a
  spring-based system.
- Native View Transitions are not universally supported, so page transitions are
  a progressive enhancement rather than a guaranteed experience.
- The reduced-motion requirement must be repeated at every animation site, and
  nothing enforces it automatically.

## Related Decisions

- [ADR-0019](0019-render-astro-first-with-react-islands-for-behavior.md)
- [ADR-0020](0020-extend-shadcn-with-base-ui-compatible-registries.md)
- [ADR-0021](0021-define-editorial-typography-and-component-boundaries.md)
