CREATE TABLE `__new_custom_domain` (
	`domain` text PRIMARY KEY NOT NULL,
	`app_id` text,
	`publisher_id` text,
	`token` text NOT NULL,
	`proven_at` integer,
	`hostname_id` text,
	`active_at` integer,
	`waiting` text,
	`checked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_custom_domain`("domain", "app_id", "token", "proven_at", "hostname_id", "active_at", "waiting", "checked_at", "created_at") SELECT "domain", "app_id", "token", "proven_at", "hostname_id", "active_at", "waiting", "checked_at", "created_at" FROM `custom_domain`;--> statement-breakpoint
DROP TABLE `custom_domain`;--> statement-breakpoint
ALTER TABLE `__new_custom_domain` RENAME TO `custom_domain`;--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domain_app_id_unique` ON `custom_domain` (`app_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_domain_publisher_id_unique` ON `custom_domain` (`publisher_id`);