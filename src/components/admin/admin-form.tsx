import { LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { ComponentProps } from 'react';

export { useHydrated } from './admin-hydration';

/**
 * A form's outcome. Progress and success go to a polite region that is always
 * rendered, so assistive technology is already listening when its text
 * changes; a failure is inserted as an alert of its own. Neither changes role,
 * which screen readers do not reliably announce. Errors that belong to one
 * field go to its FieldError instead, so nothing is announced twice.
 */
export function FormStatus({ message, error }: { message?: string; error?: string }) {
  return (
    <>
      <p role="status">{error ? '' : message}</p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

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
