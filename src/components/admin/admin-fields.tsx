import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type SharedProps = {
  id: string;
  label: string;
  name: string;
  error?: string;
  layout?: 'default' | 'wide';
};

function FieldContainer({
  layout,
  invalid,
  children,
}: {
  layout?: 'default' | 'wide';
  invalid: boolean;
  children: ReactNode;
}) {
  return layout === 'wide' ? (
    <Field data-invalid={invalid} spacing="compact" className="md:col-span-2">
      {children}
    </Field>
  ) : (
    <Field data-invalid={invalid} spacing="compact">
      {children}
    </Field>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'> & SharedProps;
type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name'> &
  SharedProps;

function describedBy(value: string | undefined, error: string | undefined, id: string) {
  return cn(value, error && `${id}-error`) || undefined;
}

export function TextField({
  id,
  label,
  name,
  error,
  layout,
  'aria-describedby': ariaDescribedby,
  ...props
}: TextFieldProps) {
  return (
    <FieldContainer layout={layout} invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(ariaDescribedby, error, id)}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </FieldContainer>
  );
}

export function TextAreaField({
  id,
  label,
  name,
  error,
  layout,
  'aria-describedby': ariaDescribedby,
  ...props
}: TextAreaFieldProps) {
  return (
    <FieldContainer layout={layout} invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(ariaDescribedby, error, id)}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </FieldContainer>
  );
}
