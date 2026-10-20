import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-transparent p-3 text-base font-normal transition-[border-color,box-shadow] duration-150 ease-out-quad outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive motion-reduce:transition-none md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50',
  {
    variants: {
      size: {
        default: '',
        compact: 'min-h-20',
      },
    },
    defaultVariants: { size: 'default' },
  }
);

function Textarea({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  );
}

export { Textarea };
