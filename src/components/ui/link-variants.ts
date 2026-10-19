import { cva } from 'class-variance-authority';

export const linkVariants = cva('', {
  variants: {
    variant: {
      accent: 'text-brand underline underline-offset-4',
      admin: 'inline-flex min-h-6 items-center underline underline-offset-4',
      adminAction:
        'inline-flex min-h-6 items-center underline underline-offset-4 disabled:opacity-50',
      articleTitle:
        'decoration-brand/40 underline-offset-[6px] transition-colors duration-150 group-hover:underline hover:text-brand motion-reduce:transition-none',
      footer:
        'inline-flex min-h-6 items-center transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
      headerBrand:
        'font-heading text-lg text-foreground transition-colors duration-150 hover:text-brand motion-reduce:transition-none',
      mobileNav:
        'rounded-md px-3 py-2 text-base text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground aria-[current]:bg-muted aria-[current]:font-medium aria-[current]:text-foreground motion-reduce:transition-none',
      nav: 'inline-flex min-h-10 items-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground aria-[current]:font-medium aria-[current]:text-foreground motion-reduce:transition-none',
      foreground:
        'text-foreground transition-colors duration-150 hover:text-brand motion-reduce:transition-none',
    },
  },
  defaultVariants: {
    variant: 'accent',
  },
});
