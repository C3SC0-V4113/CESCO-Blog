import { z } from 'zod';

import { contentDocSchema } from '@/lib/content/schema';
export const saveDraftSchema = z.strictObject({
  postId: z.string().min(1),
  localizationId: z.string().min(1),
  draftToken: z.string().nullable(),
  title: z.string().max(300),
  excerpt: z.string().max(1000).nullable(),
  contentJson: contentDocSchema.refine((doc) =>
    doc.content.every(
      (node) =>
        node.type !== 'image' &&
        (node.type !== 'heading' || node.attrs.level === 2 || node.attrs.level === 3)
    )
  ),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type EditorDraft = Omit<SaveDraftInput, 'postId' | 'localizationId'> & {
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageMediaId?: string | null;
  ogImageAlt?: string | null;
};
export type EditorLocalizations = Partial<Record<'es' | 'en', string>>;
