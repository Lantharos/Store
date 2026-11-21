PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_count_daily` (
	`app_id` text NOT NULL,
	`version` text NOT NULL,
	`platform` text NOT NULL,
	`source` text DEFAULT 'other' NOT NULL,
	`day` text NOT NULL,
	`installs` integer NOT NULL,
	`updates` integer NOT NULL,
	PRIMARY KEY(`app_id`, `version`, `platform`, `source`, `day`)
);
--> statement-breakpoint
INSERT INTO `__new_count_daily`("app_id", "version", "platform", "source", "day", "installs", "updates") SELECT "app_id", "version", "platform", 'other', "day", "installs", "updates" FROM `count_daily`;--> statement-breakpoint
DROP TABLE `count_daily`;--> statement-breakpoint
ALTER TABLE `__new_count_daily` RENAME TO `count_daily`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `count_daily_day` ON `count_daily` (`day`);--> statement-breakpoint
CREATE INDEX `count_daily_app_day` ON `count_daily` (`app_id`,`day`);