PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`editorial_state` text DEFAULT 'active' NOT NULL,
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
	`editorial_state`,
	`game_id`,
	`cover_media_id`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`section`,
	CASE WHEN `status` = 'archived' THEN 'archived' ELSE 'active' END,
	`game_id`,
	`cover_media_id`,
	`created_at`,
	`updated_at`
FROM `posts`;
--> statement-breakpoint
DROP INDEX `posts_section_idx`;--> statement-breakpoint
DROP INDEX `posts_status_idx`;--> statement-breakpoint
DROP INDEX `posts_game_id_idx`;--> statement-breakpoint
DROP INDEX `posts_cover_media_id_idx`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE INDEX `posts_section_idx` ON `posts` (`section`);--> statement-breakpoint
CREATE INDEX `posts_editorial_state_idx` ON `posts` (`editorial_state`);--> statement-breakpoint
CREATE INDEX `posts_game_id_idx` ON `posts` (`game_id`);--> statement-breakpoint
CREATE INDEX `posts_cover_media_id_idx` ON `posts` (`cover_media_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
