import { ActionError, defineAction } from 'astro:actions';

import { adminPostError, createAdminPost } from '@/actions/posts';
import { createPostSchema } from '@/lib/admin-posts';
import { getDb } from '@/lib/runtime';
export const server = {
  admin: {
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
