import { z } from 'zod';
export function normalizeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export const createPostSchema = z.object({
  section: z.enum(['analysis', 'opinion']),
  locale: z.enum(['es', 'en']),
  slug: z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160)),
});
export type CreatePostInput = z.input<typeof createPostSchema>;
export type ValidCreatePostInput = z.output<typeof createPostSchema>;
