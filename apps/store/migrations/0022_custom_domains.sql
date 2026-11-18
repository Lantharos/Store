CREATE TABLE `custom_domain` (
	`domain` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`token` text NOT NULL,
	`proven_at` integer,
	`hostname_id` text,
	`active_at` integer,
	`waiting` text,
	`checked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domain_app_id_unique` ON `custom_domain` (`app_id`);