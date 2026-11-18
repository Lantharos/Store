CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `device_code` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_code_device_code_unique` ON `device_code` (`device_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_code_user_code_unique` ON `device_code` (`user_code`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`aaguid` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkey_user` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app` (
	`id` text PRIMARY KEY NOT NULL,
	`developer_id` text NOT NULL,
	`kind` text NOT NULL,
	`format` text NOT NULL,
	`repository` text,
	`repository_id` text,
	`licence` text,
	`distribution` text DEFAULT 'open' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`developer_id`) REFERENCES `developer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_id_folded` ON `app` (lower("id"));--> statement-breakpoint
CREATE INDEX `app_developer` ON `app` (`developer_id`);--> statement-breakpoint
CREATE TABLE `developer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`github_login` text,
	`agreement_version` text NOT NULL,
	`agreement_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `developer_user_id_unique` ON `developer` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `developer_slug_unique` ON `developer` (`slug`);--> statement-breakpoint
CREATE TABLE `namespace` (
	`prefix` text PRIMARY KEY NOT NULL,
	`developer_id` text NOT NULL,
	`proof` text,
	`proof_value` text NOT NULL,
	`verified_at` integer,
	`checked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`developer_id`) REFERENCES `developer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `namespace_developer` ON `namespace` (`developer_id`);--> statement-breakpoint
CREATE TABLE `token` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`developer_id` text NOT NULL,
	`hash` text NOT NULL,
	`name` text NOT NULL,
	`last_used_at` integer,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`developer_id`) REFERENCES `developer`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_hash_unique` ON `token` (`hash`);--> statement-breakpoint
CREATE INDEX `token_app` ON `token` (`app_id`);--> statement-breakpoint
CREATE TABLE `trusted_publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`repository` text NOT NULL,
	`workflow` text NOT NULL,
	`environment` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trusted_publisher_repository` ON `trusted_publisher` (`repository_id`);--> statement-breakpoint
CREATE TABLE `listing` (
	`app_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`app_id`, `locale`),
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `listing_meta` (
	`app_id` text PRIMARY KEY NOT NULL,
	`icon_key` text,
	`categories` text DEFAULT '[]' NOT NULL,
	`homepage` text,
	`support` text,
	`privacy_url` text,
	`content_rating` text,
	`brand_color` text,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mirror_app` (
	`id` text NOT NULL,
	`origin` text NOT NULL,
	`ref` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL,
	`icon` text,
	`categories` text NOT NULL,
	`developer` text NOT NULL,
	`verified` integer NOT NULL,
	`installs_30d` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`hidden_reason` text,
	`rank` real NOT NULL,
	PRIMARY KEY(`origin`, `id`)
);
--> statement-breakpoint
CREATE TABLE `screenshot` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`platform` text,
	`position` integer NOT NULL,
	`key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`caption` text,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `screenshot_app` ON `screenshot` (`app_id`,`position`);--> statement-breakpoint
CREATE TABLE `block` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`release_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`public_note` text,
	`created_at` integer NOT NULL,
	`lifted_at` integer,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release_id`) REFERENCES `release`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `block_app` ON `block` (`app_id`);--> statement-breakpoint
CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`kind` text NOT NULL,
	`reporter_email` text,
	`details` text NOT NULL,
	`pult_item` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`pult_item` text,
	`kind` text NOT NULL,
	`decision` text,
	`decided_by` text,
	`decided_at` integer,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `release`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_release` ON `review` (`release_id`);--> statement-breakpoint
CREATE TABLE `store_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `artifact` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`format` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`executable` text,
	`upload_id` text,
	`uploaded_at` integer,
	`attestation_url` text,
	FOREIGN KEY (`release_id`) REFERENCES `release`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_name` ON `artifact` (`release_id`,`name`);--> statement-breakpoint
CREATE TABLE `check` (
	`release_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`detail_key` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`release_id`, `name`),
	FOREIGN KEY (`release_id`) REFERENCES `release`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `count_daily` (
	`app_id` text NOT NULL,
	`version` text NOT NULL,
	`platform` text NOT NULL,
	`day` text NOT NULL,
	`installs` integer NOT NULL,
	`updates` integer NOT NULL,
	PRIMARY KEY(`app_id`, `version`, `platform`, `day`)
);
--> statement-breakpoint
CREATE INDEX `count_daily_day` ON `count_daily` (`day`);--> statement-breakpoint
CREATE TABLE `delta` (
	`id` text PRIMARY KEY NOT NULL,
	`artifact_id` text NOT NULL,
	`from_release_id` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	FOREIGN KEY (`artifact_id`) REFERENCES `artifact`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_release_id`) REFERENCES `release`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `release` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`version` text NOT NULL,
	`channel` text DEFAULT 'stable' NOT NULL,
	`tag` text,
	`commit` text,
	`run_url` text,
	`workflow` text,
	`origin` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`manifest` text NOT NULL,
	`permissions` text,
	`permissions_widened` integer DEFAULT false NOT NULL,
	`requires` text NOT NULL,
	`status` text NOT NULL,
	`rollout_percent` integer DEFAULT 0 NOT NULL,
	`rollout_paused` integer DEFAULT false NOT NULL,
	`rollout_stepped_at` integer,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_version` ON `release` (`app_id`,`channel`,`version`);--> statement-breakpoint
CREATE INDEX `release_status` ON `release` (`status`);--> statement-breakpoint
CREATE TABLE `upload_part` (
	`artifact_id` text NOT NULL,
	`part` integer NOT NULL,
	`etag` text NOT NULL,
	PRIMARY KEY(`artifact_id`, `part`),
	FOREIGN KEY (`artifact_id`) REFERENCES `artifact`(`id`) ON UPDATE no action ON DELETE cascade
);
