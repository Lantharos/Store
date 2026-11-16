CREATE TABLE `search_key` (
  `id` integer PRIMARY KEY,
  `key` text NOT NULL COLLATE NOCASE UNIQUE
);
--> statement-breakpoint
CREATE VIRTUAL TABLE `search_text` USING fts5(
  `key` UNINDEXED,
  `title` UNINDEXED,
  `name`,
  `summary`,
  `keywords`,
  `developer`,
  tokenize = 'trigram'
);
--> statement-breakpoint
INSERT INTO `search_key` (`key`) SELECT `key` FROM `search` WHERE true ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO `search_text` (`rowid`, `key`, `title`, `name`, `summary`, `keywords`, `developer`)
SELECT `search_key`.`id`, `search_key`.`key`, `search`.`name`, lower(`search`.`name`), lower(`search`.`summary`), lower(`search`.`keywords`), lower(`search`.`developer`)
FROM `search` INNER JOIN `search_key` ON `search_key`.`key` = `search`.`key`
GROUP BY `search_key`.`id`;
--> statement-breakpoint
DROP TABLE `search`;
--> statement-breakpoint
INSERT INTO `store_state` (`key`, `value`) VALUES ('reindex.requested', '0') ON CONFLICT DO NOTHING;
