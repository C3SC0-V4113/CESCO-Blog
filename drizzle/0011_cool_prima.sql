PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_post_revision_media` (
	`revision_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`block_id` text NOT NULL,
	`position` integer NOT NULL,
	`alt_text` text,
	`caption` text,
	`credit_override` text,
	`asset_r2_key` text,
	`asset_width` integer,
	`asset_height` integer,
	`asset_caption` text,
	`asset_creator_name` text,
	`asset_source_url` text,
	`asset_license_label` text,
	`asset_license_url` text,
	PRIMARY KEY(`revision_id`, `block_id`, `media_asset_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `post_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_post_revision_media`("revision_id", "media_asset_id", "block_id", "position", "alt_text", "caption", "credit_override", "asset_r2_key", "asset_width", "asset_height", "asset_caption", "asset_creator_name", "asset_source_url", "asset_license_label", "asset_license_url") SELECT
	"revision_id", "media_asset_id", "block_id", "position", "alt_text", "caption", "credit_override",
	(SELECT "r2_key" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "width" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "height" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "caption" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "creator_name" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "source_url" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "license_label" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id"),
	(SELECT "license_url" FROM "media_assets" WHERE "id" = "post_revision_media"."media_asset_id")
FROM `post_revision_media`;--> statement-breakpoint
DROP TABLE `post_revision_media`;--> statement-breakpoint
ALTER TABLE `__new_post_revision_media` RENAME TO `post_revision_media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `post_revision_media_revision_block_position_unique` ON `post_revision_media` (`revision_id`,`block_id`,`position`);--> statement-breakpoint
CREATE INDEX `post_revision_media_revision_id_idx` ON `post_revision_media` (`revision_id`);--> statement-breakpoint
CREATE INDEX `post_revision_media_media_asset_id_idx` ON `post_revision_media` (`media_asset_id`);
