import { Dialog } from '@base-ui/react/dialog';
import { Menu, X } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

/**
 * Section navigation for narrow screens (DESIGN.md).
 *
 * The header's section links are hidden below `sm`, where a wordmark, four
 * destinations and two controls do not fit in one row. Without this they are
 * simply unreachable on a phone, which is most of the audience for a reading
 * site.
 *
 * An island because it is the definition of behavior (ADR-0019): a sheet has to
 * trap focus while it is open, return focus to the trigger when it closes,
 * dismiss on Escape and on an outside click, and lock the background from
 * scrolling. Base UI's dialog does all of that; a hand-rolled version gets
 * three of the five right and the misses are invisible to anyone testing with a
 * mouse.
 *
 * Labels arrive as props, so the UI dictionary (ADR-0027) stays on the server
 * and out of the client bundle.
 */

export type MobileNavItem = {
  label: string;
  href: string;
};

interface Props {
  openLabel: string;
  closeLabel: string;
  items: MobileNavItem[];
}

export default function MobileNav({ openLabel, closeLabel, items }: Props) {
  // Nothing to open when no section has a route yet — the same rule the header
  // follows, so an empty sheet never ships.
  if (items.length === 0) return null;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={openLabel}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
      >
        <Menu className="size-4" aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Fades rather than slides: ADR-0022 allows opacity and transform, and
            the panel below carries the movement. */}
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-[var(--ease-out-quad)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />

        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 border-l border-border bg-background p-6 shadow-lg transition-transform duration-200 ease-[var(--ease-out-cubic)] data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full motion-reduce:transition-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-xs tracking-wide text-muted-foreground uppercase">
              {openLabel}
            </Dialog.Title>

            <Dialog.Close
              aria-label={closeLabel}
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <nav className="flex flex-col gap-1">
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-base text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
