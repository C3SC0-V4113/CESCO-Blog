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

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    section: text('section', { enum: ['analysis', 'opinion'] }).notNull(),
    editorialState: text('editorial_state', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
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
    publishedAt: text('published_at'),
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
    index('post_localizations_published_at_idx').on(table.publishedAt),
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

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostLocalization = typeof postLocalizations.$inferSelect;
export type NewPostLocalization = typeof postLocalizations.$inferInsert;
export type PostRevision = typeof postRevisions.$inferSelect;
export type NewPostRevision = typeof postRevisions.$inferInsert;
export type PostRevisionMedia = typeof postRevisionMedia.$inferSelect;
export type NewPostRevisionMedia = typeof postRevisionMedia.$inferInsert;
