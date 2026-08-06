import { Menu } from '@base-ui/react/menu';
import { Languages } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';

/**
 * Language picker — an island, deliberately (ADR-0019, DESIGN.md).
 *
 * It was a bare link, which had two problems that only show up in the layout
 * rather than in the interaction: it sat among the section links styled like
 * one, so it read as *a place to go* rather than *a control*, and on a narrow
 * screen it competed for room with navigation that already does not fit.
 *
 * A trigger with an icon fixes both. It reads as a control, it collapses to an
 * icon on mobile, and it keeps its label where there is room for one.
 *
 * Base UI rather than a hand-rolled `<details>` because this is where accessible
 * dropdowns quietly break: focus that never returns to the trigger, Escape that
 * does nothing, arrow keys that do not move, `aria-expanded` nobody updates.
 * None of that is caught by a test we would think to write, and all of it is
 * felt by someone using a keyboard on every page. That is the "behavior"
 * ADR-0019 reserves React for.
 *
 * Labels arrive as props so the UI dictionary (ADR-0027) stays on the server.
 */

export type LocaleOption = {
  locale: string;
  label: string;
  href: string;
  current: boolean;
};

interface Props {
  triggerLabel: string;
  options: LocaleOption[];
}

export default function LocaleSwitcher({ triggerLabel, options }: Props) {
  const active = options.find((option) => option.current);

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={triggerLabel}
        className={buttonVariants({ variant: 'ghost', size: 'default' })}
      >
        <Languages className="size-4" aria-hidden="true" />
        {/* The label is what makes the control self-explanatory, and the first
            thing worth dropping when the row runs out of room. */}
        <span className="hidden sm:inline">{active?.label}</span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end">
          <Menu.Popup className="min-w-36 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
            {options.map((option) => (
              <Menu.LinkItem
                key={option.locale}
                href={option.href}
                hrefLang={option.locale}
                aria-current={option.current ? 'true' : undefined}
                className="block cursor-pointer rounded-sm px-3 py-2 text-sm text-muted-foreground outline-none select-none hover:bg-muted aria-[current]:text-foreground data-highlighted:bg-muted"
              >
                {option.label}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
