CREATE TABLE `channel` (
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`keep` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`app_id`, `name`),
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `updater_switch` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`from_updater` text NOT NULL,
	`to_updater` text NOT NULL,
	`from_format` text NOT NULL,
	`to_format` text NOT NULL,
	`started_by` text NOT NULL,
	`first_release_id` text,
	`bridge_release_id` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `updater_switch_app` ON `updater_switch` (`app_id`);--> statement-breakpoint
DROP INDEX `app_publisher`;--> statement-breakpoint
ALTER TABLE `app` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `app` SET `slug` = lower(replace(`id`, rtrim(`id`, replace(`id`, '.', '')), ''));--> statement-breakpoint
UPDATE `app` SET `status` = 'published' WHERE `status` = 'listed';--> statement-breakpoint
ALTER TABLE `app` ADD `visibility` text DEFAULT 'listed' NOT NULL;--> statement-breakpoint
ALTER TABLE `app` ADD `page_indexed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app` ADD `latest_follows_rollout` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app` ADD `updater` text;--> statement-breakpoint
UPDATE `app` SET `updater` = 'sabine' WHERE `format` = 'sabine';--> statement-breakpoint
ALTER TABLE `app` ADD `listing_requested_at` integer;--> statement-breakpoint
ALTER TABLE `app` ADD `listing_item` text;--> statement-breakpoint
CREATE UNIQUE INDEX `app_slug` ON `app` (`publisher_id`,`slug`);--> statement-breakpoint
ALTER TABLE `artifact` ADD `sha512` text;--> statement-breakpoint
ALTER TABLE `artifact` ADD `signature` text;--> statement-breakpoint
ALTER TABLE `release` ADD `format` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `release` SET `format` = (SELECT `format` FROM `app` WHERE `app`.`id` = `release`.`app_id`);--> statement-breakpoint
UPDATE `release` SET `origin` = 'manual' WHERE `origin` = 'token';--> statement-breakpoint
ALTER TABLE `release` ADD `updater` text;--> statement-breakpoint
ALTER TABLE `release` ADD `bridge` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `release` ADD `promoted_from` text;--> statement-breakpoint
UPDATE `release` SET `updater` = 'sabine' WHERE `format` = 'sabine';