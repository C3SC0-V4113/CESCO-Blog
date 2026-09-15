import { ActionError, defineAction } from 'astro:actions';

import {
  createAuthor,
  createCollection,
  saveCollection,
  saveSeoDraft,
  setFeaturedLocalization,
  updateAuthor,
} from '@/actions/admin-taxonomy';
import { createCachePurger } from '@/actions/cache-purge';
import { saveDraft } from '@/actions/drafts';
import { mediaMetadataSchema, updateMediaAsset } from '@/actions/media';
import { retryPendingPurges } from '@/actions/pending-purges';
import { adminPostError, createAdminPost } from '@/actions/posts';
import {
  publicationErrorCode,
  publishLocalization,
  renameLocalizationSlug,
  unpublishLocalization,
} from '@/actions/publishing';
import { createPostSchema } from '@/lib/admin-posts';
import {
  authorInputSchema,
  collectionInputSchema,
  createCollectionInputSchema,
  featuredInputSchema,
  seoDraftInputSchema,
} from '@/lib/admin-taxonomy';
import { saveDraftSchema } from '@/lib/drafts';
import {
  PERMANENT_REDIRECT_ACKNOWLEDGEMENT_REQUIRED,
  publishSchema,
  renameLocalizationSchema,
  unpublishSchema,
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
    createAuthor: defineAction({
      input: authorInputSchema,
      async handler(input, context) {
        try {
          return await createAuthor(getDb(), input);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message === 'author-slug-reserved') throw new ActionError({ code: 'CONFLICT' });
          context.logger.error(
            `Author creation failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
    updateAuthor: defineAction({
      input: authorInputSchema,
      async handler(input, context) {
        try {
          return await updateAuthor(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message === 'author-slug-reserved') throw new ActionError({ code: 'CONFLICT' });
          if (message === 'author-not-found') throw new ActionError({ code: 'NOT_FOUND' });
          context.logger.error(
            `Author update failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
    createCollection: defineAction({
      input: createCollectionInputSchema,
      async handler(input, context) {
        try {
          return await createCollection(getDb(), input);
        } catch (error) {
          context.logger.error(
            `Collection creation failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
    saveCollection: defineAction({
      input: collectionInputSchema,
      async handler(input, context) {
        try {
          return await saveCollection(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          // Named, so the editor can say which of the two it was.
          if (['collection-slug-locked', 'collection-slug-reserved'].includes(message))
            throw new ActionError({ code: 'CONFLICT', message });
          if (['collection-not-found', 'collection-post-not-found'].includes(message))
            throw new ActionError({ code: 'NOT_FOUND' });
          context.logger.error(
            `Collection save failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
    setFeatured: defineAction({
      input: featuredInputSchema,
      async handler(input, context) {
        try {
          return await setFeaturedLocalization(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message === 'feature-not-publishable') throw new ActionError({ code: 'BAD_REQUEST' });
          if (message === 'localization-not-found') throw new ActionError({ code: 'NOT_FOUND' });
          context.logger.error(
            `Featured update failed: ${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
    saveSeoDraft: defineAction({
      input: seoDraftInputSchema,
      async handler(input, context) {
        try {
          return await saveSeoDraft(getDb(), input, createCachePurger(context.request));
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message === 'draft-conflict') throw new ActionError({ code: 'CONFLICT' });
          if (message === 'cover-required-while-published')
            throw new ActionError({ code: 'BAD_REQUEST', message });
          if (message.endsWith('-not-found')) throw new ActionError({ code: 'NOT_FOUND' });
          context.logger.error(
            `SEO draft save failed:${error instanceof Error ? error.stack : String(error)}`
          );
          throw new ActionError({ code: 'INTERNAL_SERVER_ERROR' });
        }
      },
    }),
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
    retryPendingPurges: defineAction({
      async handler(_input, context) {
        try {
          return await retryPendingPurges(getDb(), createCachePurger(context.request));
        } catch (error) {
          throw publicationError(error, context.logger);
        }
      },
    }),
    unpublish: defineAction({
      input: unpublishSchema,
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
