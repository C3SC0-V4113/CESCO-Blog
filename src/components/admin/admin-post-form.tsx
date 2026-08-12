import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';

import { Button, buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callCreatePost } from '@/lib/admin-actions';
import {
  createPostSchema,
  type CreatePostInput,
  type ValidCreatePostInput,
} from '@/lib/admin-posts';
import { cn } from '@/lib/utils';
const t = getTranslations('es');
const fieldsClass = 'grid gap-5 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2';
type CreatePost = (input: ValidCreatePostInput) => ReturnType<typeof callCreatePost>;
export function AdminPostForm({ createPost = callCreatePost }: { createPost?: CreatePost }) {
  const [serverError, setServerError] = useState<string>();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput, unknown, ValidCreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { section: 'analysis', locale: 'es', slug: '' },
  });
  const submit = handleSubmit(async (input) => {
    const result = await createPost(input).catch(() => undefined);
    if (result && !result.error) {
      window.location.assign('/admin/posts');
      return;
    }
    const errorKey = result?.error?.code === 'CONFLICT' ? 'slugReserved' : 'createError';
    setServerError(t(`admin.posts.${errorKey}`));
  });
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex max-w-2xl flex-col gap-6"
      noValidate
    >
      <fieldset disabled={!ready} className={fieldsClass}>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('admin.posts.section')}
          <select
            {...register('section')}
            className="h-9 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="analysis">{t('nav.analysis')}</option>
            <option value="opinion">{t('nav.opinion')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('admin.posts.locale')}
          <select
            {...register('locale')}
            className="h-9 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="es">{t('locale.es')}</option>
            <option value="en">{t('locale.en')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          {t('admin.posts.slug')}
          <input
            {...register('slug')}
            aria-invalid={Boolean(errors.slug)}
            aria-describedby="slug-error"
            className="h-9 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            autoComplete="off"
          />
          {errors.slug && (
            <span id="slug-error" role="alert" className="text-sm font-normal text-destructive">
              {t('admin.posts.slugInvalid')}
            </span>
          )}
        </label>
        {serverError && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {serverError}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!ready || isSubmitting}>
          {t('admin.posts.create')}
        </Button>
        <a href="/admin/posts" className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('admin.posts.cancel')}
        </a>
      </div>
    </form>
  );
}
