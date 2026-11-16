CREATE TABLE `count_total` (
	`app_id` text PRIMARY KEY NOT NULL,
	`installs` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `count_total` (`app_id`, `installs`) SELECT `app_id`, sum(`installs`) FROM `count_daily` GROUP BY `app_id`;--> statement-breakpoint
CREATE INDEX `token_publisher` ON `token` (`publisher_id`);--> statement-breakpoint
CREATE INDEX `trusted_publisher_app` ON `trusted_publisher` (`app_id`);--> statement-breakpoint
CREATE INDEX `device_code_user` ON `device_code` (`user_id`);--> statement-breakpoint
CREATE INDEX `block_release` ON `block` (`release_id`);--> statement-breakpoint
CREATE INDEX `invite_invited_by` ON `invite` (`invited_by`);--> statement-breakpoint
CREATE INDEX `count_daily_app_day` ON `count_daily` (`app_id`,`day`);--> statement-breakpoint
CREATE INDEX `delta_artifact` ON `delta` (`artifact_id`,`from_release_id`);--> statement-breakpoint
CREATE INDEX `delta_from` ON `delta` (`from_release_id`);--> statement-breakpoint
CREATE INDEX `delta_key` ON `delta` (`key`);--> statement-breakpoint
CREATE INDEX `tool_name_publisher` ON `tool_name` (`publisher_id`);