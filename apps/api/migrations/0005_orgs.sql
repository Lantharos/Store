ALTER TABLE `developer` RENAME TO `publisher`;--> statement-breakpoint
DROP INDEX `developer_user_id_unique`;--> statement-breakpoint
DROP INDEX `developer_slug_unique`;--> statement-breakpoint
ALTER TABLE `publisher` RENAME COLUMN `user_id` TO `owner_id`;--> statement-breakpoint
ALTER TABLE `publisher` DROP COLUMN `github_login`;--> statement-breakpoint
ALTER TABLE `publisher` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `publisher` ADD `website` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `logo_key` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `verified_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_slug` ON `publisher` (`slug`);--> statement-breakpoint
ALTER TABLE `app` RENAME COLUMN `developer_id` TO `publisher_id`;--> statement-breakpoint
DROP INDEX `app_developer`;--> statement-breakpoint
CREATE INDEX `app_publisher` ON `app` (`publisher_id`);--> statement-breakpoint
ALTER TABLE `namespace` RENAME COLUMN `developer_id` TO `publisher_id`;--> statement-breakpoint
DROP INDEX `namespace_developer`;--> statement-breakpoint
CREATE INDEX `namespace_publisher` ON `namespace` (`publisher_id`);--> statement-breakpoint
ALTER TABLE `token` RENAME COLUMN `developer_id` TO `publisher_id`;--> statement-breakpoint
ALTER TABLE `user` ADD `github_login` text;--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`publisher_id` text NOT NULL,
	`email` text,
	`github_login` text,
	`role` text NOT NULL,
	`invited_by` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `invite_publisher` ON `invite` (`publisher_id`);--> statement-breakpoint
CREATE INDEX `invite_email` ON `invite` (`email`);--> statement-breakpoint
CREATE INDEX `invite_github` ON `invite` (`github_login`);--> statement-breakpoint
CREATE TABLE `member` (
	`publisher_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`publisher_id`, `user_id`),
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `member_user` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `publisher_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`publisher_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`website` text,
	`domains` text DEFAULT '[]' NOT NULL,
	`proof_token` text NOT NULL,
	`contact_email` text,
	`contact_code_hash` text,
	`contact_code_expires_at` integer,
	`contact_confirmed_at` integer,
	`github_org` text,
	`github_org_proven_at` integer,
	`note` text DEFAULT '' NOT NULL,
	`facts` text DEFAULT '[]' NOT NULL,
	`pult_item` text,
	`reason` text,
	`decided_by` text,
	`decided_at` integer,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `publisher_verification_publisher` ON `publisher_verification` (`publisher_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `verification_document` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `publisher_verification`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `verification_document_verification` ON `verification_document` (`verification_id`);--> statement-breakpoint
CREATE TABLE `verification_message` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`author` text NOT NULL,
	`name` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `publisher_verification`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `verification_message_verification` ON `verification_message` (`verification_id`);--> statement-breakpoint
UPDATE `user` SET `name` = 'Kristof Imeri' WHERE `id` = 'lantharos-owner' AND `name` = 'Lantharos';--> statement-breakpoint
INSERT INTO `publisher` (`id`, `kind`, `owner_id`, `name`, `slug`, `agreement_version`, `agreement_at`, `status`, `created_at`)
  SELECT lower(hex(randomblob(8))), 'person', `user`.`id`, `user`.`name`,
    trim(lower(replace(`user`.`name`, ' ', '-')), '-') || CASE WHEN EXISTS (SELECT 1 FROM `publisher` AS `taken` WHERE `taken`.`slug` = trim(lower(replace(`user`.`name`, ' ', '-')), '-')) THEN '-' || lower(hex(randomblob(2))) ELSE '' END,
    min(`publisher`.`agreement_version`), min(`publisher`.`agreement_at`), 'active', min(`publisher`.`created_at`)
  FROM `publisher` JOIN `user` ON `user`.`id` = `publisher`.`owner_id`
  WHERE NOT EXISTS (SELECT 1 FROM `publisher` AS `own` WHERE `own`.`owner_id` = `user`.`id` AND `own`.`kind` = 'person')
  GROUP BY `user`.`id`;--> statement-breakpoint
INSERT INTO `member` (`publisher_id`, `user_id`, `role`, `created_at`)
  SELECT `id`, `owner_id`, 'owner', `created_at` FROM `publisher` WHERE true ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_person` ON `publisher` (`owner_id`) WHERE `kind` = 'person';--> statement-breakpoint
UPDATE `publisher` SET `verified_at` = `created_at` WHERE `id` = 'lantharos';--> statement-breakpoint
INSERT INTO `publisher_verification` (`id`, `publisher_id`, `status`, `legal_name`, `website`, `domains`, `proof_token`, `decided_by`, `decided_at`, `submitted_at`, `created_at`, `updated_at`)
  SELECT lower(hex(randomblob(8))), `id`, 'approved', 'Lantharos', NULL, '[{"name":"lantharos.com","proof":"namespace","checked_at":null}]', lower(hex(randomblob(12))), 'schelf.store', `created_at`, `created_at`, `created_at`, `created_at`
  FROM `publisher` WHERE `id` = 'lantharos';
