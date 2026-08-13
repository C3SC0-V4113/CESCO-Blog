import { actions } from 'astro:actions';

import type { ValidCreatePostInput } from '@/lib/admin-posts';
import type { SaveDraftInput } from '@/lib/drafts';
export const callCreatePost = (input: ValidCreatePostInput) => actions.admin.createPost(input);
export const callSaveDraft = (input: SaveDraftInput) => actions.admin.saveDraft(input);
