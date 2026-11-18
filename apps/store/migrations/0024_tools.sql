CREATE TABLE `tool_name` (
	`name` text PRIMARY KEY NOT NULL,
	`publisher_id` text NOT NULL,
	`claimed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `app` ADD `tool` text;