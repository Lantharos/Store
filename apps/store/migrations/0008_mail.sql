CREATE TABLE `mail` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`mailbox` text NOT NULL,
	`message_id` text,
	`raw_key` text,
	`thread` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`acknowledge` integer DEFAULT false NOT NULL,
	`pult_item` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mail_message` ON `mail` (`message_id`);--> statement-breakpoint
CREATE INDEX `mail_item` ON `mail` (`pult_item`,`created_at`);