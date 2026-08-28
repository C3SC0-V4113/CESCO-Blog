import { ActionError, defineAction } from 'astro:actions';

import { createCachePurger } from '@/actions/cache-purge';
import { saveDraft } from '@/actions/drafts';
import { mediaMetadataSchema, updateMediaAsset } from '@/actions/media';
import { adminPostError, createAdminPost } from '@/actions/posts';
import {
  publicationErrorCode,
  publishLocalization,
  renameLocalizationSlug,
  retryLocalizationPurge,
  retryPublicationPurge,
  unpublishLocalization,
} from '@/actions/publishing';
import { createPostSchema } from '@/lib/admin-posts';
import { saveDraftSchema } from '@/lib/drafts';
import {
  localizationMutationSchema,
  PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED,
  publishSchema,
  renameLocalizationSchema,
} from '@/lib/publishing';
import { getDb } from '@/lib/runtime';

function publicationError(error: unknown, logger: { error(message: string): void }) {
  const code = publicationErrorCode(error);
  if (code) return new ActionError({ code });
  logger.error(
    `Publication action failed: ${error instanceof Error ? error.stack : String(error)}`
  );
  return new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
}
export const server = {
  admin: {
    publish: defineAction({
      input: publishSchema,
      async handler(input, context) {
        try {
          return await publishLocalization(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          throw publicationError(error, context.logger);
        }
      },
    }),
    retryPublicationPurge: defineAction({
      input: publishSchema,
      async handler(input, context) {
        try {
          return await retryPublicationPurge(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          throw publicationError(error, context.logger);
        }
      },
    }),
    retryLocalizationPurge: defineAction({
      input: localizationMutationSchema,
      async handler(input, context) {
        try {
          return await retryLocalizationPurge(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          throw publicationError(error, context.logger);
        }
      },
    }),
    unpublish: defineAction({
      input: localizationMutationSchema,
      async handler(input, context) {
        try {
          return await unpublishLocalization(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          throw publicationError(error, context.logger);
        }
      },
    }),
    renameLocalization: defineAction({
      input: renameLocalizationSchema,
      async handler(input, context) {
        try {
          return await renameLocalizationSlug(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          if (error instanceof Error && error.message === 'redirect-acknowledgement-required')
            return {
              status: 'rejected' as const,
              code: PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED,
            };
          throw publicationError(error, context.logger);
        }
      },
    }),
    updateMediaAsset: defineAction({
      input: mediaMetadataSchema,
      async handler(input, context) {
        try {
          return await updateMediaAsset(getDb(), input);
        } catch (error) {
          context.logger.error(
            `Media metadata update failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
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
