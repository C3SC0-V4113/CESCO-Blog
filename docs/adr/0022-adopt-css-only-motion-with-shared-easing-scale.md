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
_Superseded by the 2026-10-05 amendment below: press feedback is the
`--scale-press` token._

## Amendment — 2026-10-05: press token and interface audit

**Press feedback is a token.** The one-pixel drop above is superseded. A pressed
button now scales to `--scale-press` (`0.96`), declared in `@theme inline` beside
the easing scale and used as `active:scale-press`; Tailwind v4 resolves `scale-*`
from the `--scale` namespace. A one-pixel translate read as a layout nudge rather
than a press, and a named token keeps the value in one place instead of in every
class string that copies it. The Button primitive transitions only colour,
background, border, box-shadow and `scale`, at 150 ms on `ease-out-quad`.

**The reduced-motion convention is unchanged.** Every animation site carries
`motion-reduce:transition-none` or `motion-reduce:animate-none`, and motion stays
on for everyone else. No transition is removed for all users, and reduced motion
is never served by a weaker variant of the same motion, such as an opacity-only
fade: it gets no motion. The header and prose links keep their short colour
transitions; the invariant that high-frequency controls stay instant is read as
forbidding movement on them, not a colour change eased over 150 ms.

**Theme swaps suppress transitions for one frame.** The theme toggle injects a
`transition: none` rule, forces a style read so the new palette commits under
it, and removes the rule on the next frame. Without it every colour transition on
the page animated from the old palette to the new one. This is a rendering fix,
not a motion preference, and it is the only place transitions are suppressed for
all users; the toggle's own glyph crossfade is exempt.

**The admin opts out of cross-document view transitions.** The
`@view-transition` rule and its reduced-motion block live in
`src/styles/page-transitions.css`, imported by the public layout only. A
cross-document transition runs only when both documents opt in, so the admin,
whose queue, pagination and post-save reloads should snap, opts out by never
loading the rule. That does not depend on bundle order, which a competing
`navigation: none` rule would.

`tests/e2e/accessibility.spec.ts` asserts the press token, the reduced-motion
opt-outs on the Button, sheet and dropdown, and, in Chromium, that a followed
link cross-fades with motion on and does not with reduced motion.

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
