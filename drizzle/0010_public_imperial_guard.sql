CREATE TABLE `post_drafts` (
	`post_localization_id` text PRIMARY KEY NOT NULL,
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
	`draft_token` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_localization_id`) REFERENCES `post_localizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`og_image_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `post_drafts_og_image_media_id_idx` ON `post_drafts` (`og_image_media_id`);