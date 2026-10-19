import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Theme toggle (ADR-0019, ADR-0022).
 *
 * An island, and the extra kilobytes are bought deliberately. The alternative —
 * a plain button in Astro with a handful of inline `<script>` lines — shaves the
 * island but puts untyped DOM code in a template, where nothing type-checks it
 * and nobody thinks to look. A small readable component is worth more than the
 * bytes it saves.
 *
 * It holds **no state**. Which icon shows is decided by CSS through the `dark:`
 * variant, so the server and the client render identical markup and there is no
 * hydration mismatch to work around. The component's whole job is the click.
 *
 * The crossfade obeys ADR-0022: `transform` and `opacity` only, under 300 ms,
 * with `motion-reduce` opting out. A theme toggle is pressed rarely, so it is
 * not one of the high-frequency controls that ADR asks to keep instant.
 *
 * The stored preference is applied by a blocking inline script in the document
 * head, not here. Waiting for hydration to set the theme is what produces the
 * flash of the wrong one.
 *
 * The label arrives as a prop, keeping the UI dictionary (ADR-0027) on the
 * server and out of the client bundle.
 */

interface Props {
  label: string;
}

/**
 * Holds every transition still for the frame the theme flips in.
 *
 * Links, buttons and surfaces transition their colours, so flipping `.dark`
 * under them animates each one from the old palette to the new at its own
 * duration — a smear across the page instead of a switch. This is a rendering
 * fix, not a motion preference: nothing is animating *to* anywhere, so there is
 * nothing a reader would want to see.
 *
 * The forced style read is what makes it work. It commits the new colours while
 * the rule is still in force, so by the time the rule goes on the next frame
 * there is no change left for a transition to pick up.
 *
 * The toggle's own glyphs are exempt. Their crossfade is the one piece of
 * motion that answers the click, and suppressing it would leave the button
 * snapping while everything else, correctly, does.
 */
function withoutTransitions<T>(swap: () => T): T {
  const style = document.createElement('style');
  style.textContent = '*:not([data-theme-glyph]),*::before,*::after{transition:none!important}';
  document.head.appendChild(style);

  const result = swap();

  void window.getComputedStyle(document.body).opacity;
  requestAnimationFrame(() => style.remove());

  return result;
}

/**
 * At module scope because it closes over nothing: it reads and writes the
 * document and storage, never a prop or a piece of state.
 */
function toggleTheme() {
  const isDark = withoutTransitions(() => document.documentElement.classList.toggle('dark'));

  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch {
    // Storage can be unavailable — private browsing, a blocked third-party
    // context. The theme still flips for this page; it just will not be
    // remembered, which beats breaking the button.
  }
}

export default function ThemeToggle({ label }: Props) {
  return (
    <Button variant="ghost" size="icon-xl" onClick={toggleTheme} aria-label={label} title={label}>
      {/*
        Opacity carries the swap and scale only nudges it. The usual shadcn
        toggle animates to `scale-0`, which ADR-0022 rules out — "enter from
        scale(0.95), never from scale(0)" — because collapsing to nothing reads
        as a glitch rather than a transition. Only `transform` and `opacity` are
        animated, which is the other half of that ADR.
      */}
      <Sun
        data-theme-glyph
        className="scale-100 rotate-0 opacity-100 transition-[transform,opacity] duration-150 ease-out-quad motion-reduce:transition-none dark:scale-95 dark:-rotate-90 dark:opacity-0"
      />
      <Moon
        data-theme-glyph
        className="absolute scale-95 rotate-90 opacity-0 transition-[transform,opacity] duration-150 ease-out-quad motion-reduce:transition-none dark:scale-100 dark:rotate-0 dark:opacity-100"
      />
    </Button>
  );
}
