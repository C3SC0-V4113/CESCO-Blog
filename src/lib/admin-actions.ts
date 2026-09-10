import { actions } from 'astro:actions';

import type { mediaMetadataSchema } from '@/actions/media';
import type { ValidCreatePostInput } from '@/lib/admin-posts';
import type { SaveDraftInput } from '@/lib/drafts';
import type { PublishInput, RenameLocalizationInput, UnpublishInput } from '@/lib/publishing';
import type { z } from 'zod';

export const callCreatePost = (input: ValidCreatePostInput) => actions.admin.createPost(input);
export const callSaveDraft = (input: SaveDraftInput) => actions.admin.saveDraft(input);
export const callUpdateMediaAsset = (input: z.input<typeof mediaMetadataSchema>) =>
  actions.admin.updateMediaAsset(input);
export const callPublish = (input: PublishInput) => actions.admin.publish(input);
export const callRetryPendingPurges = () => actions.admin.retryPendingPurges();
export const callUnpublish = (input: UnpublishInput) => actions.admin.unpublish(input);
export const callRenameLocalization = (input: RenameLocalizationInput) =>
  actions.admin.renameLocalization(input);
