import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const mediaAssets = sqliteTable(
  'media_assets',
  {
    id: text('id').primaryKey(),
    r2Key: text('r2_key').notNull(),
    altText: text('alt_text'),
    caption: text('caption'),
    description: text('description'),
    isOwnWork: integer('is_own_work', { mode: 'boolean' }).notNull().default(false),
    creatorName: text('creator_name'),
    sourceUrl: text('source_url'),
    licenseLabel: text('license_label'),
    licenseUrl: text('license_url'),
    contentType: text('content_type').notNull(),
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('media_assets_r2_key_unique').on(table.r2Key),
    index('media_assets_content_type_idx').on(table.contentType),
  ]
);

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    developer: text('developer'),
    publisher: text('publisher'),
    releaseDate: text('release_date'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('games_slug_unique').on(table.slug),
    index('games_title_idx').on(table.title),
  ]
);

export const authors = sqliteTable(
  'authors',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    bio: text('bio'),
    avatarMediaId: text('avatar_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    websiteUrl: text('website_url'),
    sameAs: text('same_as', { mode: 'json' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('authors_slug_unique').on(table.slug),
    index('authors_avatar_media_id_idx').on(table.avatarMediaId),
  ]
);

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    section: text('section', { enum: ['analysis', 'opinion'] }).notNull(),
    editorialState: text('editorial_state', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    authorId: text('author_id').references(() => authors.id, { onDelete: 'set null' }),
    gameId: text('game_id').references(() => games.id, { onDelete: 'set null' }),
    coverMediaId: text('cover_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('posts_section_idx').on(table.section),
    index('posts_editorial_state_idx').on(table.editorialState),
    index('posts_author_id_idx').on(table.authorId),
    index('posts_game_id_idx').on(table.gameId),
    index('posts_cover_media_id_idx').on(table.coverMediaId),
  ]
);

export const postLocalizations = sqliteTable(
  'post_localizations',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    slug: text('slug').notNull(),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    publishedRevisionId: text('published_revision_id'),
    /**
     * Set on first publication, never cleared and never overwritten. Sole
     * determinant of whether a withdrawn URL answers 410 instead of 404, and the
     * source of `datePublished`. See ADR-0010.
     */
    firstPublishedAt: text('first_published_at'),
    /**
     * Updated on every publication event for editorial bookkeeping. Never
     * cleared on unpublish and never used for public ordering. See ADR-0010.
     */
    currentPublishedAt: text('current_published_at'),
    featuredAt: text('featured_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('post_localizations_post_id_locale_unique').on(table.postId, table.locale),
    uniqueIndex('post_localizations_locale_slug_unique').on(table.locale, table.slug),
    index('post_localizations_locale_idx').on(table.locale),
    index('post_localizations_status_idx').on(table.status),
    index('post_localizations_published_revision_id_idx').on(table.publishedRevisionId),
    index('post_localizations_first_published_at_idx').on(table.firstPublishedAt),
    index('post_localizations_featured_at_idx').on(table.featuredAt),
  ]
);

/**
 * Retired slugs, kept so old URLs can answer 301 instead of breaking. Entries are
 * never deleted: ADR-0010 reserves retired slugs permanently. On a second rename
 * every row pointing at the previous slug is rewritten to the current one, so a
 * retired slug always resolves in a single hop.
 *
 * Reuse prevention is an application invariant, not a database constraint —
 * SQLite cannot express uniqueness spanning this table and `post_localizations`.
 */
export const postLocalizationSlugHistory = sqliteTable(
  'post_localization_slug_history',
  {
    id: text('id').primaryKey(),
    postLocalizationId: text('post_localization_id')
      .notNull()
      .references(() => postLocalizations.id, { onDelete: 'cascade' }),
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    oldSlug: text('old_slug').notNull(),
    retiredAt: text('retired_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('post_localization_slug_history_locale_old_slug_unique').on(
      table.locale,
      table.oldSlug
    ),
    index('post_localization_slug_history_post_localization_id_idx').on(table.postLocalizationId),
  ]
);

export const postRevisions = sqliteTable(
  'post_revisions',
  {
    id: text('id').primaryKey(),
    postLocalizationId: text('post_localization_id')
      .notNull()
      .references(() => postLocalizations.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    contentJson: text('content_json', { mode: 'json' }).notNull(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    canonicalUrl: text('canonical_url'),
    ogTitle: text('og_title'),
    ogDescription: text('og_description'),
    ogImageMediaId: text('og_image_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    ogImageAlt: text('og_image_alt'),
    /**
     * Derived from `content_json` at publish time. Safe to persist because a
     * revision is immutable, so the value cannot drift from its source. Avoids
     * reparsing rich text on every uncached render. See ADR-0012.
     */
    readingTimeMinutes: integer('reading_time_minutes'),
    /** Heading outline with anchors derived from `content_json` block IDs, never from heading text. */
    tocJson: text('toc_json', { mode: 'json' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('post_revisions_post_localization_id_version_unique').on(
      table.postLocalizationId,
      table.version
    ),
    index('post_revisions_post_localization_id_idx').on(table.postLocalizationId),
    index('post_revisions_og_image_media_id_idx').on(table.ogImageMediaId),
    index('post_revisions_created_at_idx').on(table.createdAt),
  ]
);

export const postRevisionMedia = sqliteTable(
  'post_revision_media',
  {
    revisionId: text('revision_id')
      .notNull()
      .references(() => postRevisions.id, { onDelete: 'cascade' }),
    mediaAssetId: text('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    blockId: text('block_id').notNull(),
    position: integer('position').notNull(),
    altText: text('alt_text'),
    caption: text('caption'),
    creditOverride: text('credit_override'),
  },
  (table) => [
    primaryKey({ columns: [table.revisionId, table.blockId, table.mediaAssetId] }),
    uniqueIndex('post_revision_media_revision_block_position_unique').on(
      table.revisionId,
      table.blockId,
      table.position
    ),
    index('post_revision_media_revision_id_idx').on(table.revisionId),
    index('post_revision_media_media_asset_id_idx').on(table.mediaAssetId),
  ]
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('tags_slug_unique').on(table.slug),
    uniqueIndex('tags_name_unique').on(table.name),
  ]
);

export const postTags = sqliteTable(
  'post_tags',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_tag_id_idx').on(table.tagId),
  ]
);

/**
 * Editorial series. Locale-neutral aggregate, mirroring how `posts` relates to
 * `post_localizations`. A collection can span sections, so an analysis and an
 * opinion piece may belong to the same series. See ADR-0012.
 */
export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    editorialState: text('editorial_state', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    coverMediaId: text('cover_media_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('collections_editorial_state_idx').on(table.editorialState),
    index('collections_cover_media_id_idx').on(table.coverMediaId),
  ]
);

export const collectionLocalizations = sqliteTable(
  'collection_localizations',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    locale: text('locale', { enum: ['es', 'en'] }).notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    /**
     * Same contract as `postLocalizations.firstPublishedAt`: set once, never
     * cleared. Without it a withdrawn collection URL could not answer 410, and
     * the ADR-0010 invariant would hold for posts but not for collections.
     */
    firstPublishedAt: text('first_published_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('collection_localizations_collection_id_locale_unique').on(
      table.collectionId,
      table.locale
    ),
    uniqueIndex('collection_localizations_locale_slug_unique').on(table.locale, table.slug),
    index('collection_localizations_status_idx').on(table.status),
  ]
);

export const collectionPosts = sqliteTable(
  'collection_posts',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.postId] }),
    uniqueIndex('collection_posts_collection_id_position_unique').on(
      table.collectionId,
      table.position
    ),
    index('collection_posts_post_id_idx').on(table.postId),
  ]
);

export const platforms = sqliteTable(
  'platforms',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
  },
  (table) => [
    uniqueIndex('platforms_slug_unique').on(table.slug),
    uniqueIndex('platforms_name_unique').on(table.name),
  ]
);

export const gamePlatforms = sqliteTable(
  'game_platforms',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.platformId] }),
    index('game_platforms_platform_id_idx').on(table.platformId),
  ]
);

export const genres = sqliteTable(
  'genres',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
  },
  (table) => [
    uniqueIndex('genres_slug_unique').on(table.slug),
    uniqueIndex('genres_name_unique').on(table.name),
  ]
);

export const gameGenres = sqliteTable(
  'game_genres',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    genreId: text('genre_id')
      .notNull()
      .references(() => genres.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.genreId] }),
    index('game_genres_genre_id_idx').on(table.genreId),
  ]
);

/**
 * Analysis-specific editorial metadata. Locale-neutral: the visible disclosure
 * sentence is localized from UI strings, so only structured values live here. A
 * free-form disclosure note would be localized content and would belong on a
 * per-localization table instead. See ADR-0012.
 */
export const postAnalysisMetadata = sqliteTable(
  'post_analysis_metadata',
  {
    postId: text('post_id')
      .primaryKey()
      .references(() => posts.id, { onDelete: 'cascade' }),
    playedPlatformId: text('played_platform_id').references(() => platforms.id, {
      onDelete: 'set null',
    }),
    playtimeHours: integer('playtime_hours'),
    completionState: text('completion_state', {
      enum: ['completed', 'main_story', 'partial', 'abandoned', 'ongoing'],
    }),
    receivedReviewCopy: integer('received_review_copy', { mode: 'boolean' })
      .notNull()
      .default(false),
    reviewCopyProvider: text('review_copy_provider'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('post_analysis_metadata_played_platform_id_idx').on(table.playedPlatformId),
    index('post_analysis_metadata_received_review_copy_idx').on(table.receivedReviewCopy),
  ]
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostLocalization = typeof postLocalizations.$inferSelect;
export type NewPostLocalization = typeof postLocalizations.$inferInsert;
export type PostRevision = typeof postRevisions.$inferSelect;
export type NewPostRevision = typeof postRevisions.$inferInsert;
export type PostRevisionMedia = typeof postRevisionMedia.$inferSelect;
export type NewPostRevisionMedia = typeof postRevisionMedia.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type PostLocalizationSlugHistory = typeof postLocalizationSlugHistory.$inferSelect;
export type NewPostLocalizationSlugHistory = typeof postLocalizationSlugHistory.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionLocalization = typeof collectionLocalizations.$inferSelect;
export type NewCollectionLocalization = typeof collectionLocalizations.$inferInsert;
export type CollectionPost = typeof collectionPosts.$inferSelect;
export type NewCollectionPost = typeof collectionPosts.$inferInsert;
export type PostAnalysisMetadata = typeof postAnalysisMetadata.$inferSelect;
export type NewPostAnalysisMetadata = typeof postAnalysisMetadata.$inferInsert;
