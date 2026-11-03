ALTER TABLE `user` ADD `github_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `user` ADD `avatar` text DEFAULT 'github' NOT NULL;--> statement-breakpoint
UPDATE `user` SET `github_id` = (SELECT `account_id` FROM `account` WHERE `account`.`user_id` = `user`.`id` AND `account`.`provider_id` = 'github' LIMIT 1);
