import { LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ComponentProps, ReactNode } from 'react';

/*
 * One look for every admin text field, textarea and select. Fields draw the
 * same ring as the Button primitive rather than the base outline, so a form's
 * controls answer focus alike. An invalid field changes its border only: the
 * ring stays the focus colour, so focus is never hidden behind the error.
 */
const field =
  'w-full min-w-0 rounded-lg border bg-background font-normal transition-[border-color,box-shadow] duration-150 ease-out-quad outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50';

export const inputClass = cn(field, 'h-10 px-3');
export const selectClass = inputClass;
export const textareaClass = cn(field, 'min-h-24 p-3');

export const fieldErrorId = (name: string) => `${name}-error`;

/** What an invalid field carries, so its message is read with it. */
export function invalidField(
  name: string,
  invalid: boolean
): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return invalid ? { 'aria-invalid': true, 'aria-describedby': fieldErrorId(name) } : {};
}

/**
 * The message beside the field it belongs to, found by `fieldErrorId(name)`.
 * Render it outside the field's `<label>`, or it becomes part of the name.
 */
export function FieldError({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p id={fieldErrorId(name)} role="alert" className="mt-1 text-sm text-destructive">
      {children}
    </p>
  );
}

/**
 * A button that stays put while its request runs: disabled, with a spinner,
 * and still saying what it does, so the label carries the state even with the
 * spinner held still for reduced motion (ADR-0022).
 */
export function PendingButton({
  pending,
  disabled,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button disabled={pending || disabled} {...props}>
      {pending && (
        <LoaderCircleIcon
          aria-hidden="true"
          data-icon="inline-start"
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </Button>
  );
}
