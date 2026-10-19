import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { linkVariants } from '@/components/ui/link-variants';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * Section navigation for narrow screens (DESIGN.md).
 *
 * The header's section links are hidden below `sm`, where a wordmark, four
 * destinations and two controls do not fit in one row. Without this they are
 * unreachable on a phone, which is most of the audience for a reading site.
 *
 * An island because it is the definition of behavior (ADR-0019): a sheet has to
 * trap focus while open, return it to the trigger on close, dismiss on Escape
 * and on an outside click, and lock background scrolling. The registry
 * component brings all of that (ADR-0020); a hand-rolled version gets three of
 * the five right, and the misses are invisible to anyone testing with a mouse.
 *
 * Labels arrive as props, so the UI dictionary (ADR-0027) stays on the server
 * and out of the client bundle.
 */

export type MobileNavItem = {
  label: string;
  href: string;
  /**
   * Decided on the server, not read from `location` here.
   *
   * The sheet renders on the server before it hydrates, and a client-side check
   * would mark the wrong item — or nothing — in that first paint.
   */
  current: boolean;
};

interface Props {
  openLabel: string;
  closeLabel: string;
  /** Names the landmark inside the sheet; the dialog's title names the sheet. */
  navLabel: string;
  items: MobileNavItem[];
}

export default function MobileNav({ openLabel, closeLabel, navLabel, items }: Props) {
  // Nothing to open when no section has a route yet — the same rule the header
  // follows, so an empty sheet never ships.
  if (items.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-xl" aria-label={openLabel}>
            <Menu />
          </Button>
        }
      />

      <SheetContent side="right" closeLabel={closeLabel}>
        <SheetHeader>
          <SheetTitle>{openLabel}</SheetTitle>
        </SheetHeader>

        <nav aria-label={navLabel} className="flex flex-col gap-1 px-4">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={linkVariants({ variant: 'mobileNav' })}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
