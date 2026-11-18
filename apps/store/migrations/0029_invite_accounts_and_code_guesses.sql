DROP INDEX `invite_github`;--> statement-breakpoint
ALTER TABLE `invite` ADD `github_id` text;--> statement-breakpoint
CREATE INDEX `invite_github` ON `invite` (`github_id`);--> statement-breakpoint
ALTER TABLE `publisher_verification` ADD `contact_code_guesses` integer DEFAULT 0 NOT NULL;