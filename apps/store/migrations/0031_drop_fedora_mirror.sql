DELETE FROM `search_text` WHERE `rowid` IN (SELECT `id` FROM `search_key` WHERE `key` >= 'fedora:' AND `key` < 'fedora;');
--> statement-breakpoint
DELETE FROM `search_key` WHERE `key` >= 'fedora:' AND `key` < 'fedora;';
--> statement-breakpoint
DELETE FROM `mirror_app` WHERE `origin` = 'fedora';
