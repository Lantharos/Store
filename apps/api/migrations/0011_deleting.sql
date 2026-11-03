ALTER TABLE `app` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `app` ADD `status_before_delete` text;--> statement-breakpoint
ALTER TABLE `app` ADD `purged_at` integer;