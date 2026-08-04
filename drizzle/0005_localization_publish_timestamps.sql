ALTER TABLE `post_localizations` ADD `first_published_at` text;--> statement-breakpoint
ALTER TABLE `post_localizations` ADD `current_published_at` text;--> statement-breakpoint
ALTER TABLE `post_localizations` ADD `featured_at` text;--> statement-breakpoint
CREATE INDEX `post_localizations_first_published_at_idx` ON `post_localizations` (`first_published_at`);--> statement-breakpoint
CREATE INDEX `post_localizations_featured_at_idx` ON `post_localizations` (`featured_at`);--> statement-breakpoint
-- Backfill: carry the legacy publication timestamp into both successors before
-- `published_at` is dropped in 0006. `first_published_at` must never be null for
-- a localization that was ever public, because ADR-0010 makes it the sole
-- determinant of 410 vs 404.
UPDATE `post_localizations`
SET
	`first_published_at` = `published_at`,
	`current_published_at` = `published_at`
WHERE `published_at` IS NOT NULL;