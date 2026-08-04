CREATE TABLE `collection_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`locale` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_localizations_collection_id_locale_unique` ON `collection_localizations` (`collection_id`,`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_localizations_locale_slug_unique` ON `collection_localizations` (`locale`,`slug`);--> statement-breakpoint
CREATE INDEX `collection_localizations_status_idx` ON `collection_localizations` (`status`);--> statement-breakpoint
CREATE TABLE `collection_posts` (
	`collection_id` text NOT NULL,
	`post_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `post_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_posts_collection_id_position_unique` ON `collection_posts` (`collection_id`,`position`);--> statement-breakpoint
CREATE INDEX `collection_posts_post_id_idx` ON `collection_posts` (`post_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`editorial_state` text DEFAULT 'active' NOT NULL,
	`cover_media_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `collections_editorial_state_idx` ON `collections` (`editorial_state`);--> statement-breakpoint
CREATE INDEX `collections_cover_media_id_idx` ON `collections` (`cover_media_id`);--> statement-breakpoint
CREATE TABLE `post_analysis_metadata` (
	`post_id` text PRIMARY KEY NOT NULL,
	`played_platform_id` text,
	`playtime_hours` integer,
	`completion_state` text,
	`received_review_copy` integer DEFAULT false NOT NULL,
	`review_copy_provider` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`played_platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `post_analysis_metadata_played_platform_id_idx` ON `post_analysis_metadata` (`played_platform_id`);--> statement-breakpoint
CREATE INDEX `post_analysis_metadata_received_review_copy_idx` ON `post_analysis_metadata` (`received_review_copy`);