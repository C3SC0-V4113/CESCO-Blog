import { z } from 'zod';

import { normalizeSlug } from '@/lib/admin-posts';
import { draftTokenSchema, nextTokenSchema } from '@/lib/drafts';

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim() || null)
    .nullable();

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const nullableHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => !value || isHttpUrl(value))
  .transform((value) => value || null)
  .nullable();

const httpUrl = z.string().trim().max(2048).refine(isHttpUrl);

export const createCollectionInputSchema = z.strictObject({ id: z.uuid() });

export const authorInputSchema = z.strictObject({
  id: z.uuid(),
  slug: z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160)),
  name: z.string().trim().min(1).max(300),
  bio: nullableText(5000).optional().default(null),
  avatarMediaId: z.uuid().nullable(),
  websiteUrl: nullableHttpUrl.optional().default(null),
  sameAs: z.array(httpUrl).max(20).default([]),
});

const collectionLocalizationSchema = z.strictObject({
  id: z.uuid(),
  locale: z.enum(['es', 'en']),
  slug: z.string().transform(normalizeSlug).pipe(z.string().min(1).max(160)),
  title: z.string().trim().min(1).max(300),
  description: nullableText(5000).optional().default(null),
  status: z.enum(['draft', 'published', 'archived']),
});

export const collectionInputSchema = z
  .strictObject({
    id: z.uuid(),
    editorialState: z.enum(['active', 'archived']),
    localizations: z.array(collectionLocalizationSchema).min(1).max(2),
    postIds: z.array(z.uuid()),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.localizations.map(({ locale }) => locale)).size !== value.localizations.length
    )
      context.addIssue({ code: 'custom', path: ['localizations'], message: 'duplicate-locale' });
    if (new Set(value.postIds).size !== value.postIds.length)
      context.addIssue({ code: 'custom', path: ['postIds'], message: 'duplicate-membership' });
  });

export const featuredInputSchema = z.strictObject({
  localizationId: z.uuid(),
  featured: z.boolean(),
});

type CollectionLocale = 'es' | 'en';
export type CollectionLocaleForm = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
};

/**
 * The localizations a collection form actually carries. A blank locale is
 * absent rather than invalid, so a series can exist in Spanish alone. One that
 * already exists is always sent, so clearing it fails instead of being kept
 * silently. Each locale is judged on its own, so the editor can name the one
 * that is incomplete.
 */
export function pickCollectionLocalizations(
  forms: Record<CollectionLocale, CollectionLocaleForm>,
  existing: ReadonlySet<CollectionLocale>
) {
  const localizations: Array<z.input<typeof collectionLocalizationSchema>> = [];
  const incomplete: CollectionLocale[] = [];
  for (const locale of ['es', 'en'] as const) {
    const form = forms[locale];
    const touched = [form.slug, form.title, form.description].some((value) => value.trim());
    if (!touched && !existing.has(locale)) continue;
    const candidate = {
      id: form.id,
      locale,
      slug: form.slug,
      title: form.title,
      description: form.description || null,
      status: form.status,
    };
    if (collectionLocalizationSchema.safeParse(candidate).success) localizations.push(candidate);
    else incomplete.push(locale);
  }
  return { localizations, incomplete };
}

export const seoDraftInputSchema = z.strictObject({
  postId: z.uuid(),
  localizationId: z.uuid(),
  // The draft row has one token, shared with the editor's autosave, so SEO
  // saves speak the same protocol (ADR-0035).
  draftToken: draftTokenSchema,
  nextToken: nextTokenSchema,
  seoTitle: nullableText(300),
  seoDescription: nullableText(1000),
  ogTitle: nullableText(300),
  ogDescription: nullableText(1000),
  ogImageMediaId: z.uuid().nullable(),
  ogImageAlt: nullableText(1000),
  coverMediaId: z.uuid().nullable(),
  authorId: z.uuid().nullable(),
});

export type AuthorInput = z.input<typeof authorInputSchema>;
export type CreateCollectionInput = z.input<typeof createCollectionInputSchema>;
export type CollectionInput = z.input<typeof collectionInputSchema>;
export type FeaturedInput = z.input<typeof featuredInputSchema>;
export type SeoDraftInput = z.input<typeof seoDraftInputSchema>;
