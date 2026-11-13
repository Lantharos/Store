ALTER TABLE `app` ADD `platforms` text;--> statement-breakpoint
ALTER TABLE `app` ADD `parts` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `artifact` ADD `part` text;