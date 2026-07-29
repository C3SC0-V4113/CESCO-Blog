CREATE TABLE `post_revision_media` (
	`revision_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`block_id` text NOT NULL,
	`position` integer NOT NULL,
	`alt_text` text,
	`caption` text,
	`credit_override` text,
	PRIMARY KEY(`revision_id`, `block_id`, `media_asset_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_revision_media_revision_block_position_unique` ON `post_revision_media` (`revision_id`,`block_id`,`position`);--> statement-breakpoint
CREATE INDEX `post_revision_media_revision_id_idx` ON `post_revision_media` (`revision_id`);--> statement-breakpoint
CREATE INDEX `post_revision_media_media_asset_id_idx` ON `post_revision_media` (`media_asset_id`);--> statement-breakpoint
ALTER TABLE `media_assets` ADD `description` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `is_own_work` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `creator_name` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `license_label` text;--> statement-breakpoint
ALTER TABLE `media_assets` ADD `license_url` text;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `og_title` text;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `og_description` text;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `og_image_media_id` text REFERENCES media_assets(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `og_image_alt` text;--> statement-breakpoint
CREATE INDEX `post_revisions_og_image_media_id_idx` ON `post_revisions` (`og_image_media_id`);
