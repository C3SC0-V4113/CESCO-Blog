CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`bio` text,
	`avatar_media_id` text,
	`website_url` text,
	`same_as` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`avatar_media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_slug_unique` ON `authors` (`slug`);--> statement-breakpoint
CREATE INDEX `authors_avatar_media_id_idx` ON `authors` (`avatar_media_id`);--> statement-breakpoint
ALTER TABLE `posts` ADD `author_id` text REFERENCES authors(id);--> statement-breakpoint
CREATE INDEX `posts_author_id_idx` ON `posts` (`author_id`);