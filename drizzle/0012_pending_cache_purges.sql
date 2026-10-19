CREATE TABLE `pending_cache_purges` (
	`id` text PRIMARY KEY NOT NULL,
	`tags` text NOT NULL,
	`action` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
