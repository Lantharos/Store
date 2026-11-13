CREATE TABLE `channel_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`channel` text NOT NULL,
	`email` text NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_invite_email` ON `channel_invite` (`app_id`,`channel`,`email`);--> statement-breakpoint
CREATE INDEX `channel_invite_person` ON `channel_invite` (`email`);--> statement-breakpoint
CREATE TABLE `channel_token` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`channel` text NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_token_hash_unique` ON `channel_token` (`hash`);--> statement-breakpoint
CREATE INDEX `channel_token_app` ON `channel_token` (`app_id`,`channel`);--> statement-breakpoint
ALTER TABLE `channel` ADD `invite_only` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `artifact_key` ON `artifact` (`key`);