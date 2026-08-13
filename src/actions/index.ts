import { ActionError, defineAction } from 'astro:actions';

import { saveDraft } from '@/actions/drafts';
import { adminPostError, createAdminPost } from '@/actions/posts';
import { createPostSchema } from '@/lib/admin-posts';
import { saveDraftSchema } from '@/lib/drafts';
import { getDb } from '@/lib/runtime';
export const server = {
  admin: {
    saveDraft: defineAction({
      input: saveDraftSchema,
      async handler(input, context) {
        try {
          return await saveDraft(getDb(), input);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message !== 'draft-conflict' && message !== 'draft-not-found')
            context.logger.error(
              `Draft save failed: ${error instanceof Error ? error.stack : String(error)}`
            );
          throw new ActionError({
            code:
              message === 'draft-conflict'
                ? 'CONFLICT'
                : message === 'draft-not-found'
                  ? 'NOT_FOUND'
                  : 'INTERNAL_SERVER_ERROR',
          });
        }
      },
    }),
    createPost: defineAction({
      input: createPostSchema,
      async handler(input, context) {
        try {
          return await createAdminPost(getDb(), input);
        } catch (error) {
          throw new ActionError(adminPostError(error, context.logger));
        }
      },
    }),
  },
};
