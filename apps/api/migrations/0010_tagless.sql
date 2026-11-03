ALTER TABLE `trusted_publisher` ADD `ref` text;--> statement-breakpoint
ALTER TABLE `release` ADD `ref` text;--> statement-breakpoint
UPDATE `release` SET `ref` = 'refs/tags/' || `tag` WHERE `tag` IS NOT NULL AND `origin` = 'oidc';--> statement-breakpoint
ALTER TABLE `release` DROP COLUMN `tag`;
