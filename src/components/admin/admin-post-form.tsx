import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';

import { buttonVariants } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTranslations } from '@/i18n/utils';
import { callCreatePost } from '@/lib/admin-actions';
import {
  createPostSchema,
  type CreatePostInput,
  type ValidCreatePostInput,
} from '@/lib/admin-posts';
import { cn } from '@/lib/utils';

import {
  FieldError as AdminFieldError,
  PendingButton,
  invalidField,
  useHydrated,
} from './admin-form';
const t = getTranslations('es');
const fieldsClass = 'rounded-xl border bg-card p-5 shadow-sm';
const sections = [
  { value: 'analysis', label: t('nav.analysis') },
  { value: 'opinion', label: t('nav.opinion') },
] as const;
const locales = [
  { value: 'es', label: t('locale.es') },
  { value: 'en', label: t('locale.en') },
] as const;
type CreatePost = (input: ValidCreatePostInput) => ReturnType<typeof callCreatePost>;
const assignLocation = (href: string) => window.location.assign(href);

function ControlledSelect({
  control,
  name,
  id,
  label,
  items,
  disabled,
}: {
  control: Control<CreatePostInput, unknown, ValidCreatePostInput>;
  name: 'section' | 'locale';
  id: string;
  label: string;
  items: readonly { value: string; label: string }[];
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            items={items}
            disabled={disabled}
          >
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
export function AdminPostForm({
  createPost = callCreatePost,
  navigate = assignLocation,
}: {
  createPost?: CreatePost;
  navigate?: (href: string) => void;
}) {
  const [serverError, setServerError] = useState<string>();
  const ready = useHydrated();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput, unknown, ValidCreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { section: 'analysis', locale: 'es', slug: '' },
  });
  const submit = handleSubmit(async (input) => {
    const result = await createPost(input).catch(() => undefined);
    if (result && !result.error) {
      navigate('/admin/posts');
      return;
    }
    if (result?.error?.code === 'CONFLICT') {
      setServerError(undefined);
      setError(
        'slug',
        { type: 'server', message: t('admin.posts.slugReserved') },
        { shouldFocus: true }
      );
      return;
    }
    setServerError(t('admin.posts.createError'));
  });
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
      noValidate
    >
      <fieldset disabled={!ready} className={fieldsClass}>
        <FieldGroup className="grid w-full gap-5 sm:grid-cols-2">
          <ControlledSelect
            control={control}
            name="section"
            id="section"
            label={t('admin.posts.section')}
            items={sections}
            disabled={!ready}
          />
          <ControlledSelect
            control={control}
            name="locale"
            id="locale"
            label={t('admin.posts.locale')}
            items={locales}
            disabled={!ready}
          />
          <Field data-invalid={Boolean(errors.slug)} className="sm:col-span-2">
            <FieldLabel htmlFor="slug">{t('admin.posts.slug')}</FieldLabel>
            <Input
              {...register('slug')}
              id="slug"
              {...invalidField('slug', Boolean(errors.slug))}
              className="h-9 font-normal"
              autoComplete="off"
              spellCheck={false}
            />
            {errors.slug && (
              <AdminFieldError name="slug">
                {errors.slug.type === 'server' ? errors.slug.message : t('admin.posts.slugInvalid')}
              </AdminFieldError>
            )}
          </Field>
        </FieldGroup>
        {serverError && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {serverError}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <PendingButton type="submit" pending={isSubmitting} disabled={!ready}>
          {t('admin.posts.create')}
        </PendingButton>
        <a href="/admin/posts" className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('admin.posts.cancel')}
        </a>
      </div>
    </form>
  );
}
