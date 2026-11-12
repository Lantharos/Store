ALTER TABLE `app` ADD `config_files` text;--> statement-breakpoint
ALTER TABLE `listing` DROP COLUMN `sources`;--> statement-breakpoint
ALTER TABLE `listing_meta` DROP COLUMN `sources`;