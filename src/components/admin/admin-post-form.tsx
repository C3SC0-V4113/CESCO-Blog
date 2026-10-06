import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';

import { buttonVariants } from '@/components/ui/button';
import { getTranslations } from '@/i18n/utils';
import { callCreatePost } from '@/lib/admin-actions';
import {
  createPostSchema,
  type CreatePostInput,
  type ValidCreatePostInput,
} from '@/lib/admin-posts';
import { cn } from '@/lib/utils';

import { FieldError, inputClass, invalidField, PendingButton, selectClass } from './admin-form';

const t = getTranslations('es');
const fieldsClass = 'grid gap-5 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2';
type CreatePost = (input: ValidCreatePostInput) => ReturnType<typeof callCreatePost>;
const assignLocation = (href: string) => window.location.assign(href);
export function AdminPostForm({
  createPost = callCreatePost,
  navigate = assignLocation,
}: {
  createPost?: CreatePost;
  navigate?: (href: string) => void;
}) {
  const [serverError, setServerError] = useState<string>();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const {
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
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('admin.posts.section')}
          <select {...register('section')} className={selectClass}>
            <option value="analysis">{t('nav.analysis')}</option>
            <option value="opinion">{t('nav.opinion')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('admin.posts.locale')}
          <select {...register('locale')} className={selectClass}>
            <option value="es">{t('locale.es')}</option>
            <option value="en">{t('locale.en')}</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t('admin.posts.slug')}
            <input
              {...register('slug')}
              {...invalidField('slug', Boolean(errors.slug))}
              className={inputClass}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {errors.slug && (
            <FieldError name="slug">
              {errors.slug.type === 'server' ? errors.slug.message : t('admin.posts.slugInvalid')}
            </FieldError>
          )}
        </div>
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
