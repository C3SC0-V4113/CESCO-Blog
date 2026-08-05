import { Moon, Sun } from 'lucide-react';

/**
 * The only island the public chrome ships (ADR-0019, DESIGN.md).
 *
 * It holds **no React state**, and that is the design rather than an
 * oversight. Which icon shows is decided by CSS through the `dark:` variant, so
 * the server and the client render identical markup and there is no hydration
 * mismatch to paper over. The component's whole job is the click: flip the
 * class the stylesheet keys off, and remember the choice.
 *
 * The label arrives as a prop instead of being looked up here, which keeps the
 * UI dictionary (ADR-0027) on the server and out of the client bundle.
 *
 * The stored preference is applied by a blocking inline script in the document
 * head, not by this component. Waiting for hydration to set the theme is what
 * produces the flash of the wrong one.
 */

interface Props {
  label: string;
}

/**
 * At module scope because it closes over nothing: it reads and writes the
 * document and storage, never a prop or a piece of state. Declaring it inside
 * the component would rebuild the same function on every render for no reason.
 */
function toggle() {
  const isDark = document.documentElement.classList.toggle('dark');

  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch {
    // Storage can be unavailable — Safari private browsing, a blocked
    // third-party context. The theme still flips for this page; it just will
    // not be remembered, which beats breaking the button.
  }
}

export default function ThemeToggle({ label }: Props) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Sun className="size-5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-5 dark:block" aria-hidden="true" />
    </button>
  );
}
