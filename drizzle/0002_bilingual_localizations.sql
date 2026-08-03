PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `post_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_revision_id` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `post_localizations` (
	`id`,
	`post_id`,
	`locale`,
	`slug`,
	`status`,
	`published_revision_id`,
	`published_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id` || ':es',
	`id`,
	'es',
	`slug`,
	`status`,
	`published_revision_id`,
	`published_at`,
	`created_at`,
	`updated_at`
FROM `posts`;
--> statement-breakpoint
CREATE UNIQUE INDEX `post_localizations_post_id_locale_unique` ON `post_localizations` (`post_id`,`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_localizations_locale_slug_unique` ON `post_localizations` (`locale`,`slug`);--> statement-breakpoint
CREATE INDEX `post_localizations_locale_idx` ON `post_localizations` (`locale`);--> statement-breakpoint
CREATE INDEX `post_localizations_status_idx` ON `post_localizations` (`status`);--> statement-breakpoint
CREATE INDEX `post_localizations_published_revision_id_idx` ON `post_localizations` (`published_revision_id`);--> statement-breakpoint
CREATE INDEX `post_localizations_published_at_idx` ON `post_localizations` (`published_at`);--> statement-breakpoint
CREATE TABLE `__new_post_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_localization_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`content_json` text NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`og_title` text,
	`og_description` text,
	`og_image_media_id` text,
	`og_image_alt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_localization_id`) REFERENCES `post_localizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`og_image_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_post_revisions` (
	`id`,
	`post_localization_id`,
	`version`,
	`title`,
	`excerpt`,
	`content_json`,
	`seo_title`,
	`seo_description`,
	`canonical_url`,
	`og_title`,
	`og_description`,
	`og_image_media_id`,
	`og_image_alt`,
	`created_at`
)
SELECT
	`post_revisions`.`id`,
	`post_localizations`.`id`,
	`post_revisions`.`version`,
	`post_revisions`.`title`,
	`post_revisions`.`excerpt`,
	`post_revisions`.`content_json`,
	`post_revisions`.`seo_title`,
	`post_revisions`.`seo_description`,
	`post_revisions`.`canonical_url`,
	`post_revisions`.`og_title`,
	`post_revisions`.`og_description`,
	`post_revisions`.`og_image_media_id`,
	`post_revisions`.`og_image_alt`,
	`post_revisions`.`created_at`
FROM `post_revisions`
INNER JOIN `post_localizations`
	ON `post_localizations`.`post_id` = `post_revisions`.`post_id`
	AND `post_localizations`.`locale` = 'es';
--> statement-breakpoint
DROP INDEX `post_revisions_post_id_version_unique`;--> statement-breakpoint
DROP INDEX `post_revisions_post_id_idx`;--> statement-breakpoint
DROP INDEX `post_revisions_og_image_media_id_idx`;--> statement-breakpoint
DROP INDEX `post_revisions_created_at_idx`;--> statement-breakpoint
DROP TABLE `post_revisions`;--> statement-breakpoint
ALTER TABLE `__new_post_revisions` RENAME TO `post_revisions`;--> statement-breakpoint
CREATE UNIQUE INDEX `post_revisions_post_localization_id_version_unique` ON `post_revisions` (`post_localization_id`,`version`);--> statement-breakpoint
CREATE INDEX `post_revisions_post_localization_id_idx` ON `post_revisions` (`post_localization_id`);--> statement-breakpoint
CREATE INDEX `post_revisions_og_image_media_id_idx` ON `post_revisions` (`og_image_media_id`);--> statement-breakpoint
CREATE INDEX `post_revisions_created_at_idx` ON `post_revisions` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`game_id` text,
	`cover_media_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_posts` (
	`id`,
	`section`,
	`status`,
	`game_id`,
	`cover_media_id`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`section`,
	`status`,
	`game_id`,
	`cover_media_id`,
	`created_at`,
	`updated_at`
FROM `posts`;
--> statement-breakpoint
DROP INDEX `posts_slug_unique`;--> statement-breakpoint
DROP INDEX `posts_section_idx`;--> statement-breakpoint
DROP INDEX `posts_status_idx`;--> statement-breakpoint
DROP INDEX `posts_game_id_idx`;--> statement-breakpoint
DROP INDEX `posts_cover_media_id_idx`;--> statement-breakpoint
DROP INDEX `posts_published_revision_id_idx`;--> statement-breakpoint
DROP INDEX `posts_published_at_idx`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE INDEX `posts_section_idx` ON `posts` (`section`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_game_id_idx` ON `posts` (`game_id`);--> statement-breakpoint
CREATE INDEX `posts_cover_media_id_idx` ON `posts` (`cover_media_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
