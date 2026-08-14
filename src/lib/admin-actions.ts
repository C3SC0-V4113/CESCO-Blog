import { actions } from 'astro:actions';

import type { mediaMetadataSchema } from '@/actions/media';
import type { ValidCreatePostInput } from '@/lib/admin-posts';
import type { SaveDraftInput } from '@/lib/drafts';
import type { z } from 'zod';

export const callCreatePost = (input: ValidCreatePostInput) => actions.admin.createPost(input);
export const callSaveDraft = (input: SaveDraftInput) => actions.admin.saveDraft(input);
export const callUpdateMediaAsset = (input: z.input<typeof mediaMetadataSchema>) =>
  actions.admin.updateMediaAsset(input);
