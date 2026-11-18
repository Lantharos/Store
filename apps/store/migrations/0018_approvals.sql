CREATE TABLE `approval` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actions` text NOT NULL,
	`steps` text NOT NULL,
	`secrets` text DEFAULT '{}' NOT NULL,
	`passkey` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`host` text,
	`place` text,
	`expires_at` integer NOT NULL,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `approval_user` ON `approval` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `session` ADD `via` text;--> statement-breakpoint
UPDATE `session` SET `via` = 'browser' WHERE `user_agent` LIKE 'Mozilla/%';