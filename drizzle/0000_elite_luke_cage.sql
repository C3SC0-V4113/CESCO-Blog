CREATE TABLE `game_genres` (
	`game_id` text NOT NULL,
	`genre_id` text NOT NULL,
	PRIMARY KEY(`game_id`, `genre_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_genres_genre_id_idx` ON `game_genres` (`genre_id`);--> statement-breakpoint
CREATE TABLE `game_platforms` (
	`game_id` text NOT NULL,
	`platform_id` text NOT NULL,
	PRIMARY KEY(`game_id`, `platform_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_platforms_platform_id_idx` ON `game_platforms` (`platform_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`developer` text,
	`publisher` text,
	`release_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE INDEX `games_title_idx` ON `games` (`title`);--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_slug_unique` ON `genres` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`alt_text` text,
	`caption` text,
	`content_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_r2_key_unique` ON `media_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `media_assets_content_type_idx` ON `media_assets` (`content_type`);--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_slug_unique` ON `platforms` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_name_unique` ON `platforms` (`name`);--> statement-breakpoint
CREATE TABLE `post_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`content_json` text NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_revisions_post_id_version_unique` ON `post_revisions` (`post_id`,`version`);--> statement-breakpoint
CREATE INDEX `post_revisions_post_id_idx` ON `post_revisions` (`post_id`);--> statement-breakpoint
CREATE INDEX `post_revisions_created_at_idx` ON `post_revisions` (`created_at`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tags_tag_id_idx` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`section` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`game_id` text,
	`cover_media_id` text,
	`published_revision_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_section_idx` ON `posts` (`section`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_game_id_idx` ON `posts` (`game_id`);--> statement-breakpoint
CREATE INDEX `posts_cover_media_id_idx` ON `posts` (`cover_media_id`);--> statement-breakpoint
CREATE INDEX `posts_published_revision_id_idx` ON `posts` (`published_revision_id`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);