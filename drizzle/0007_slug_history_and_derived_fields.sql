CREATE TABLE `post_localization_slug_history` (
	`id` text PRIMARY KEY NOT NULL,
	`post_localization_id` text NOT NULL,
	`locale` text NOT NULL,
	`old_slug` text NOT NULL,
	`retired_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_localization_id`) REFERENCES `post_localizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_localization_slug_history_locale_old_slug_unique` ON `post_localization_slug_history` (`locale`,`old_slug`);--> statement-breakpoint
CREATE INDEX `post_localization_slug_history_post_localization_id_idx` ON `post_localization_slug_history` (`post_localization_id`);--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `reading_time_minutes` integer;--> statement-breakpoint
ALTER TABLE `post_revisions` ADD `toc_json` text;