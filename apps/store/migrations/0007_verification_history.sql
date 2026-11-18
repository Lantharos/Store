CREATE TABLE `verification_event` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`kind` text NOT NULL,
	`by` text,
	`text` text,
	`checks` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `publisher_verification`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_event_verification` ON `verification_event` (`verification_id`,`created_at`);--> statement-breakpoint
INSERT INTO `verification_event` (`id`, `verification_id`, `kind`, `created_at`) SELECT lower(hex(randomblob(12))), `id`, 'submitted', `submitted_at` FROM `publisher_verification` WHERE `submitted_at` IS NOT NULL;--> statement-breakpoint
INSERT INTO `verification_event` (`id`, `verification_id`, `kind`, `by`, `text`, `created_at`) SELECT lower(hex(randomblob(12))), `verification_id`, CASE `author` WHEN 'store' THEN 'more-requested' ELSE 'replied' END, `name`, `text`, `created_at` FROM `verification_message`;--> statement-breakpoint
INSERT INTO `verification_event` (`id`, `verification_id`, `kind`, `by`, `text`, `created_at`) SELECT lower(hex(randomblob(12))), `id`, `status`, `decided_by`, `reason`, `decided_at` FROM `publisher_verification` WHERE `status` IN ('approved', 'rejected', 'revoked') AND `decided_at` IS NOT NULL;
