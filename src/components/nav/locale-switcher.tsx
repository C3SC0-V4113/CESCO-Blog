import { Check, Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Language picker (ADR-0019, ADR-0020).
 *
 * It was a bare link, which had two problems that show up in the layout rather
 * than in the interaction: it sat among the section links styled like one, so
 * it read as *a place to go* rather than *a control*, and on a narrow screen it
 * competed for room with navigation that already does not fit.
 *
 * A trigger with an icon fixes both. It reads as a control, collapses to an
 * icon on mobile, and keeps its label where there is room.
 *
 * The registry component rather than a hand-rolled `<details>` because this is
 * where accessible dropdowns quietly break: focus that never returns to the
 * trigger, Escape that does nothing, arrow keys that do not move,
 * `aria-expanded` nobody updates. None of that is caught by a test we would
 * think to write, and all of it is felt by someone using a keyboard on every
 * page. That is the behavior ADR-0019 reserves React for.
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" aria-label={triggerLabel}>
            <Languages />
            {/* The label makes the control self-explanatory, and is the first
                thing worth dropping when the row runs out of room. */}
            <span className="hidden sm:inline">{active?.label}</span>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="min-w-36">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.locale}
            render={
              <a href={option.href} hrefLang={option.locale}>
                {option.label}
                {option.current && <Check className="ml-auto" />}
              </a>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
